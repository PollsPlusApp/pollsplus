import Foundation
import SwiftUI

// MARK: - Auth
struct AuthResponse: Codable {
    let user: User
    let token: String
}

struct User: Codable, Identifiable {
    let id: Int
    let username: String
    let email: String?
    let category: String
    let createdAt: String?
    let followerCount: Int?
    let followingCount: Int?
    let isFollowing: Bool?
    let isBlocked: Bool?

    enum CodingKeys: String, CodingKey {
        case id, username, email, category
        case createdAt = "created_at"
        case followerCount = "follower_count"
        case followingCount = "following_count"
        case isFollowing = "is_following"
        case isBlocked = "is_blocked"
    }
}

// MARK: - Debates
struct Debate: Codable, Identifiable {
    let id: Int
    let title: String?
    let category: String
    let communityId: Int?
    let createdAt: String
    let authorId: Int
    let authorUsername: String
    let authorCategory: String
    let options: [DebateOption]
    let totalVotes: Int
    let myVoteOptionId: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, category, options
        case communityId = "community_id"
        case createdAt = "created_at"
        case authorId = "author_id"
        case authorUsername = "author_username"
        case authorCategory = "author_category"
        case totalVotes = "total_votes"
        case myVoteOptionId = "my_vote_option_id"
    }

    var hasVoted: Bool { myVoteOptionId != nil }

    var timeAgo: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: createdAt) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: createdAt) else { return "" }
            return date.timeAgoDisplay()
        }
        return date.timeAgoDisplay()
    }
}

struct DebateOption: Codable, Identifiable {
    let id: Int
    let label: String
    let position: Int
    let voteCount: Int

    enum CodingKeys: String, CodingKey {
        case id, label, position
        case voteCount = "vote_count"
    }

    func percentage(of total: Int) -> Double {
        guard total > 0 else { return 0 }
        return Double(voteCount) / Double(total) * 100
    }
}

struct DebatesResponse: Codable {
    let debates: [Debate]
}

struct CreateDebateRequest: Codable {
    let title: String?
    let category: String
    let options: [String]
    let communityId: Int?

    enum CodingKeys: String, CodingKey {
        case title, category, options
        case communityId = "community_id"
    }
}

// MARK: - Communities
struct Community: Codable, Identifiable {
    let id: Int
    let name: String
    let category: String
    let founderId: Int
    let isPrivate: Bool
    let createdAt: String
    let founderUsername: String?
    let memberCount: Int?
    let isMember: Bool?
    let isPending: Bool?
    let isFounder: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, category
        case founderId = "founder_id"
        case isPrivate = "is_private"
        case createdAt = "created_at"
        case founderUsername = "founder_username"
        case memberCount = "member_count"
        case isMember = "is_member"
        case isPending = "is_pending"
        case isFounder = "is_founder"
    }
}

struct CommunitiesResponse: Codable {
    let communities: [Community]
}

struct CommunityMember: Codable, Identifiable {
    let id: Int
    let username: String
    let category: String
    let joinedAt: String?
    let requestedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, username, category
        case joinedAt = "joined_at"
        case requestedAt = "requested_at"
    }
}

// MARK: - Notifications
struct AppNotification: Codable, Identifiable {
    let id: Int
    let type: String
    let read: Bool
    let createdAt: String
    let fromUserId: Int
    let fromUsername: String
    let fromUserCategory: String

    enum CodingKeys: String, CodingKey {
        case id, type, read
        case createdAt = "created_at"
        case fromUserId = "from_user_id"
        case fromUsername = "from_username"
        case fromUserCategory = "from_user_category"
    }

    var timeAgo: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: createdAt) else {
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: createdAt) else { return "" }
            return date.timeAgoDisplay()
        }
        return date.timeAgoDisplay()
    }
}

struct NotificationsResponse: Codable {
    let notifications: [AppNotification]
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case notifications
        case unreadCount = "unread_count"
    }
}

// MARK: - Generic
struct SuccessResponse: Codable {
    let success: Bool
}

struct JoinResponse: Codable {
    let success: Bool
    let status: String
}

struct ErrorResponse: Codable {
    let error: String
}

struct UsersResponse: Codable {
    let users: [User]
}

struct MembersResponse: Codable {
    let members: [CommunityMember]
}

struct PendingResponse: Codable {
    let pending: [CommunityMember]
}

struct SearchResponse: Codable {
    let users: [User]
    let communities: [Community]
    let debates: [Debate]
}

// MARK: - Helpers
struct CategoryHelper {
    static let all = ["Sports", "Movies", "Video Games", "Politics", "Business/Tech", "General"]

    static func icon(for category: String) -> String {
        switch category {
        case "Sports": return "flame.fill"
        case "Movies": return "popcorn.fill"
        case "Video Games": return "gamecontroller.fill"
        case "Politics": return "building.columns.fill"
        case "Business/Tech": return "cpu.fill"
        case "General": return "sparkles"
        default: return "questionmark.circle.fill"
        }
    }

    static func color(for category: String) -> Color {
        switch category {
        case "Sports": return Color(red: 1.0, green: 0.35, blue: 0.15)      // Fiery orange-red
        case "Movies": return Color(red: 0.65, green: 0.2, blue: 0.85)      // Rich violet
        case "Video Games": return Color(red: 0.1, green: 0.8, blue: 0.45)  // Neon green
        case "Politics": return Color(red: 0.85, green: 0.15, blue: 0.25)   // Bold crimson
        case "Business/Tech": return Color(red: 0.15, green: 0.55, blue: 1.0) // Electric blue
        case "General": return Color(red: 0.55, green: 0.55, blue: 0.65)    // Cool slate
        default: return Color.gray
        }
    }

    static func gradient(for category: String) -> LinearGradient {
        let base = color(for: category)
        return LinearGradient(
            colors: [base, base.opacity(0.7)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static func darkGradient(for category: String) -> LinearGradient {
        let base = color(for: category)
        return LinearGradient(
            colors: [base.opacity(0.15), base.opacity(0.05)],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Date Extension
extension Date {
    func timeAgoDisplay() -> String {
        let seconds = Int(-self.timeIntervalSinceNow)
        if seconds < 60 { return "just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        if days < 30 { return "\(days)d" }
        let months = days / 30
        if months < 12 { return "\(months)mo" }
        return "\(months / 12)y"
    }
}
