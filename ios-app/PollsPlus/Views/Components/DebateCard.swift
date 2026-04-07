import SwiftUI

struct DebateCard: View {
    let debate: Debate
    var onVote: ((Int) -> Void)?
    var onDeleteVote: (() -> Void)?
    var onTapAuthor: ((Int) -> Void)?
    var onDelete: (() -> Void)?
    var onPin: (() -> Void)?
    var onUnpin: (() -> Void)?

    private var catColor: Color { CategoryHelper.color(for: debate.category) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            cardHeader
            titleSection
            expiryBanner
            optionsSection
            footerSection
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18)
                .fill(Color(.systemBackground))
                .shadow(color: catColor.opacity(0.1), radius: 12, y: 4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(catColor.opacity(0.12), lineWidth: 1)
        )
        .overlay(alignment: .topTrailing) {
            pinBadge
        }
    }

    // MARK: - Header

    private var cardHeader: some View {
        HStack(spacing: 10) {
            CategoryIcon(category: debate.authorCategory, size: 38)

            VStack(alignment: .leading, spacing: 3) {
                Button {
                    onTapAuthor?(debate.authorId)
                } label: {
                    Text(debate.authorUsername)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                }

                HStack(spacing: 6) {
                    CategoryBadge(category: debate.category)
                    Text(debate.timeAgo)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer()

            cardMenu
        }
    }

    @ViewBuilder
    private var cardMenu: some View {
        let hasActions = onDelete != nil || debate.hasVoted || debate.authorId == (NetworkManager.shared.currentUserId ?? -1)
        if hasActions {
            Menu {
                if debate.hasVoted || debate.authorId == (NetworkManager.shared.currentUserId ?? -1) {
                    if debate.isPinned == true {
                        Button { onUnpin?() } label: {
                            Label("Unpin", systemImage: "pin.slash")
                        }
                    } else {
                        Button { onPin?() } label: {
                            Label("Pin to Profile", systemImage: "pin.fill")
                        }
                    }
                }
                if let onDelete = onDelete {
                    Button("Delete Debate", role: .destructive) { onDelete() }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: 30, height: 30)
            }
        }
    }

    @ViewBuilder
    private var pinBadge: some View {
        if debate.isPinned == true {
            Image(systemName: "pin.fill")
                .font(.caption2)
                .foregroundColor(.white)
                .padding(5)
                .background(catColor)
                .clipShape(Circle())
                .offset(x: -8, y: 8)
        }
    }

    // MARK: - Title

    @ViewBuilder
    private var titleSection: some View {
        if let title = debate.title, !title.isEmpty {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
        }
    }

    // MARK: - Expiry Banner

    @ViewBuilder
    private var expiryBanner: some View {
        if let display = debate.expiryDisplay {
            HStack(spacing: 5) {
                Image(systemName: debate.isExpired ? "lock.fill" : "clock.fill")
                    .font(.caption2)
                Text(display)
                    .font(.caption.bold())
            }
            .foregroundColor(debate.isExpired ? .red : .orange)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(debate.isExpired ? Color.red.opacity(0.1) : Color.orange.opacity(0.1))
            .clipShape(Capsule())
        }
    }

    // MARK: - Options

    private var optionsSection: some View {
        VStack(spacing: 8) {
            ForEach(debate.options) { option in
                if debate.hasVoted || debate.isExpired {
                    VotedOptionRow(
                        option: option,
                        totalVotes: debate.totalVotes,
                        isMyVote: option.id == debate.myVoteOptionId,
                        catColor: catColor
                    )
                } else {
                    Button {
                        onVote?(option.id)
                    } label: {
                        Text(option.label)
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(catColor.opacity(0.08))
                            .foregroundStyle(.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(catColor.opacity(0.2), lineWidth: 1)
                            )
                    }
                }
            }
        }
    }

    // MARK: - Footer

    private var footerSection: some View {
        HStack {
            Label("\(debate.totalVotes)", systemImage: "chart.bar.fill")
                .font(.caption.bold())
                .foregroundStyle(catColor.opacity(0.7))

            if let voteTime = debate.voteTimestampDisplay {
                Text(voteTime)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if debate.hasVoted && debate.votingOpen {
                Button {
                    onDeleteVote?()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.uturn.backward")
                        Text("Remove Vote")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct VotedOptionRow: View {
    let option: DebateOption
    let totalVotes: Int
    let isMyVote: Bool
    let catColor: Color

    private var pct: Double { option.percentage(of: totalVotes) }

    var body: some View {
        ZStack(alignment: .leading) {
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 12)
                    .fill(isMyVote ? catColor.opacity(0.2) : Color(.systemGray5).opacity(0.6))
                    .frame(width: max(geo.size.width * (pct / 100), 0))
            }

            HStack {
                if isMyVote {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(catColor)
                }
                Text(option.label)
                    .font(.subheadline.weight(isMyVote ? .bold : .medium))
                Spacer()
                Text("\(option.voteCount)")
                    .font(.caption.bold())
                    .foregroundStyle(.tertiary)
                Text(String(format: "%.0f%%", pct))
                    .font(.subheadline.bold())
                    .foregroundStyle(isMyVote ? catColor : .primary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
        }
        .frame(height: 46)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isMyVote ? catColor.opacity(0.4) : Color.clear, lineWidth: 1.5)
        )
    }
}
