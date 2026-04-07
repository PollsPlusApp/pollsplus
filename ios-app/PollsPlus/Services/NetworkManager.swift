import Foundation
import FirebaseAnalytics

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case serverError(String)
    case unauthorized
    case decodingError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .noData: return "No data received"
        case .serverError(let msg): return msg
        case .unauthorized: return "Please log in again"
        case .decodingError(let msg): return "Data error: \(msg)"
        }
    }
}

@MainActor
class NetworkManager: ObservableObject {
    static let shared = NetworkManager()

    private let baseURL = "https://pollsplus-production.up.railway.app"
    @Published var token: String? {
        didSet { UserDefaults.standard.set(token, forKey: "jwt_token") }
    }
    @Published var currentUserId: Int? {
        didSet { UserDefaults.standard.set(currentUserId, forKey: "user_id") }
    }
    @Published var currentUsername: String? {
        didSet { UserDefaults.standard.set(currentUsername, forKey: "username") }
    }

    init() {
        self.token = UserDefaults.standard.string(forKey: "jwt_token")
        let storedId = UserDefaults.standard.integer(forKey: "user_id")
        self.currentUserId = storedId != 0 ? storedId : nil
        self.currentUsername = UserDefaults.standard.string(forKey: "username")
    }

    var isLoggedIn: Bool { token != nil }

    func logout() {
        token = nil
        currentUserId = nil
        currentUsername = nil
        UserDefaults.standard.removeObject(forKey: "jwt_token")
        UserDefaults.standard.removeObject(forKey: "user_id")
        UserDefaults.standard.removeObject(forKey: "username")
    }

    // MARK: - Core Request
    private func request<T: Decodable>(
        _ method: String,
        path: String,
        body: (any Encodable)? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        if httpResponse.statusCode >= 400 {
            if let errorResp = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResp.error)
            }
            throw APIError.serverError("Server error (\(httpResponse.statusCode))")
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }

    // Fire-and-forget request (for seen, etc.)
    private func requestNoResponse(_ method: String, path: String, body: (any Encodable)? = nil) async throws {
        let _: SuccessResponse = try await request(method, path: path, body: body)
    }

    // MARK: - Auth
    func register(username: String, email: String, password: String, category: String) async throws -> AuthResponse {
        struct Body: Encodable { let username, email, password, category: String }
        let resp: AuthResponse = try await request("POST", path: "/api/auth/register",
            body: Body(username: username, email: email, password: password, category: category))
        token = resp.token
        currentUserId = resp.user.id
        currentUsername = resp.user.username
        Analytics.logEvent("sign_up", parameters: ["category": category])
        return resp
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        struct Body: Encodable { let email, password: String }
        let resp: AuthResponse = try await request("POST", path: "/api/auth/login",
            body: Body(email: email, password: password))
        Analytics.logEvent("login", parameters: nil)
        token = resp.token
        currentUserId = resp.user.id
        currentUsername = resp.user.username
        return resp
    }

    // MARK: - Users
    func getUser(id: Int) async throws -> User {
        try await request("GET", path: "/api/users/\(id)")
    }

    func getUserDebates(id: Int, page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/users/\(id)/debates?page=\(page)")
    }

    func follow(userId: Int) async throws {
        try await requestNoResponse("POST", path: "/api/users/\(userId)/follow")
        Analytics.logEvent("follow_user", parameters: nil)
    }

    func unfollow(userId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/users/\(userId)/follow")
    }

    func getFollowing(userId: Int, page: Int = 1) async throws -> UsersResponse {
        try await request("GET", path: "/api/users/\(userId)/following?page=\(page)")
    }

    func getFollowers(userId: Int, page: Int = 1) async throws -> UsersResponse {
        try await request("GET", path: "/api/users/\(userId)/followers?page=\(page)")
    }

    func block(userId: Int) async throws {
        try await requestNoResponse("POST", path: "/api/users/\(userId)/block")
    }

    func unblock(userId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/users/\(userId)/block")
    }

    func reportUser(userId: Int, reason: String) async throws {
        struct Body: Encodable { let reason: String }
        try await requestNoResponse("POST", path: "/api/users/\(userId)/report", body: Body(reason: reason))
    }

    func getVotedDebates(page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/users/me/voted?page=\(page)")
    }

    func getPinnedDebates(page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/users/me/pinned?page=\(page)")
    }

    func getMyCommunities(page: Int = 1) async throws -> CommunitiesResponse {
        try await request("GET", path: "/api/users/me/communities?page=\(page)")
    }

    func deleteAccount() async throws {
        try await requestNoResponse("DELETE", path: "/api/users/me")
        logout()
    }

    func updateCategory(_ category: String) async throws {
        struct Body: Encodable { let category: String }
        let _: SuccessResponse = try await request("PUT", path: "/api/users/me/category", body: Body(category: category))
    }

    // MARK: - Debates
    func createDebate(title: String?, category: String, options: [String], communityId: Int? = nil, expiresAt: String? = nil) async throws -> Debate {
        let result: Debate = try await request("POST", path: "/api/debates",
            body: CreateDebateRequest(title: title, category: category, options: options, communityId: communityId, expiresAt: expiresAt))
        Analytics.logEvent("create_debate", parameters: ["category": category, "option_count": options.count, "has_deadline": expiresAt != nil])
        return result
    }

    func getDebate(id: Int) async throws -> Debate {
        try await request("GET", path: "/api/debates/\(id)")
    }

    func deleteDebate(id: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/debates/\(id)")
    }

    func vote(debateId: Int, optionId: Int) async throws {
        struct Body: Encodable { let option_id: Int }
        try await requestNoResponse("POST", path: "/api/debates/\(debateId)/vote", body: Body(option_id: optionId))
        Analytics.logEvent("vote", parameters: nil)
    }

    func deleteVote(debateId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/debates/\(debateId)/vote")
    }

    func pinDebate(debateId: Int) async throws {
        try await requestNoResponse("POST", path: "/api/debates/\(debateId)/pin")
    }

    func unpinDebate(debateId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/debates/\(debateId)/pin")
    }

    func reportDebate(debateId: Int, reason: String) async throws {
        struct Body: Encodable { let reason: String }
        try await requestNoResponse("POST", path: "/api/debates/\(debateId)/report", body: Body(reason: reason))
    }

    func markSeen(debateId: Int) async throws {
        try await requestNoResponse("POST", path: "/api/debates/\(debateId)/seen")
    }

    // MARK: - Feeds
    func feedFollowing(page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/feeds/following?page=\(page)")
    }

    func feedCommunities(page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/feeds/communities?page=\(page)")
    }

    func feedCategory(_ category: String, page: Int = 1) async throws -> DebatesResponse {
        let encoded = category.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? category
        return try await request("GET", path: "/api/feeds/category/\(encoded)?page=\(page)")
    }

    func feedPopular(page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/feeds/popular?page=\(page)")
    }

    // MARK: - Communities
    func createCommunity(name: String, category: String, isPrivate: Bool) async throws -> Community {
        struct Body: Encodable { let name, category: String; let is_private: Bool }
        let result: Community = try await request("POST", path: "/api/communities",
            body: Body(name: name, category: category, is_private: isPrivate))
        Analytics.logEvent("create_community", parameters: ["category": category, "is_private": isPrivate])
        return result
    }

    func getCommunity(id: Int) async throws -> Community {
        try await request("GET", path: "/api/communities/\(id)")
    }

    func getCommunityDebates(id: Int, page: Int = 1) async throws -> DebatesResponse {
        try await request("GET", path: "/api/communities/\(id)/debates?page=\(page)")
    }

    func joinCommunity(id: Int) async throws -> JoinResponse {
        let result: JoinResponse = try await request("POST", path: "/api/communities/\(id)/join")
        Analytics.logEvent("join_community", parameters: nil)
        return result
    }

    func leaveCommunity(id: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/communities/\(id)/leave")
    }

    func getCommunityMembers(id: Int, page: Int = 1) async throws -> MembersResponse {
        try await request("GET", path: "/api/communities/\(id)/members?page=\(page)")
    }

    func getPendingRequests(id: Int) async throws -> PendingResponse {
        try await request("GET", path: "/api/communities/\(id)/pending")
    }

    func approveRequest(communityId: Int, userId: Int) async throws {
        try await requestNoResponse("POST", path: "/api/communities/\(communityId)/approve/\(userId)")
    }

    func removeMember(communityId: Int, userId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/communities/\(communityId)/members/\(userId)")
    }

    func deleteCommunityDebate(communityId: Int, debateId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/communities/\(communityId)/debates/\(debateId)")
    }

    func browseCommunities(category: String, page: Int = 1) async throws -> CommunitiesResponse {
        let encoded = category.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? category
        return try await request("GET", path: "/api/communities/browse/\(encoded)?page=\(page)")
    }

    // MARK: - Notifications
    func getNotifications(page: Int = 1) async throws -> NotificationsResponse {
        try await request("GET", path: "/api/notifications?page=\(page)")
    }

    func markNotificationsRead() async throws {
        try await requestNoResponse("POST", path: "/api/notifications/read")
    }

    // MARK: - Comments
    func getComments(debateId: Int, page: Int = 1) async throws -> CommentsResponse {
        try await request("GET", path: "/api/debates/\(debateId)/comments?page=\(page)")
    }

    func getReplies(debateId: Int, commentId: Int, page: Int = 1) async throws -> RepliesResponse {
        try await request("GET", path: "/api/debates/\(debateId)/comments/\(commentId)/replies?page=\(page)")
    }

    func postComment(debateId: Int, content: String, parentId: Int? = nil) async throws -> Comment {
        struct Body: Encodable { let content: String; let parent_id: Int? }
        let result: Comment = try await request("POST", path: "/api/debates/\(debateId)/comments",
            body: Body(content: content, parent_id: parentId))
        Analytics.logEvent("post_comment", parameters: ["is_reply": parentId != nil])
        return result
    }

    func deleteComment(debateId: Int, commentId: Int) async throws {
        try await requestNoResponse("DELETE", path: "/api/debates/\(debateId)/comments/\(commentId)")
    }

    // MARK: - Search
    func search(query: String) async throws -> SearchResponse {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await request("GET", path: "/api/search?q=\(encoded)")
    }
}
