# PollsPlus — Complete Project Spec & Reference

## Core Concept
Social media app (iOS) where users scroll a feed of debates/polls and vote on them. Like TikTok/Twitter but the feed is scrollable debates. No images anywhere — category icons replace profile pictures.

## Categories
Sports, Movies, Video Games, Politics, Business/Tech, General.
Every user, post, and community is assigned one category. The category acts as the user/community avatar.

## Debates (Posts)
- Title (optional)
- 2 or more sides/options to vote on (creator chooses how many and names them)
- Before voting: see total vote count
- After voting: see each side's count and percentage
- Users can delete their vote
- One vote per user per debate

## Feeds
- **Following** — posts from people you follow only
- **My Communities** — posts from communities you're in
- **Category feeds** — browse any of the 6 categories
- **Popular** — algorithm based on votes + comments + recency bonus for last 24hrs
- Category and Popular feeds hide posts the user has already seen or voted on
- Profile pages and community pages show ALL posts regardless

## Communities
- Public or private
- Anyone can create one
- Public = anyone can join; Private = request to join, founder approves
- Each community has: name, category, founder, member count
- Members can post inside a community
- Posts inside a community still have their own category (chosen by poster)
  - A Politics community post about Sports appears in BOTH the Sports category feed AND inside the Politics community
- Founders can remove members and delete posts

## User Profiles
- Username, category as avatar, follower count, following count
- All their posted debates visible and votable
- Tap any username anywhere to visit their profile

## Social Features
- Follow/unfollow with correct button logic
- Following page (list of who you follow)
- Block (completely hides each other)
- Report (flags post or user for admin review)
- Notifications — only for new followers, ask permission on first app launch

## Voting Rules
- One vote per user per debate
- Percentages and counts appear after voting
- Delete vote button appears after voting, disappears when tapped

## Seen Posts Tracking
- Track which posts each user has seen or voted on
- Filter these out of Category and Popular feeds
- Do NOT filter from Profile or Community pages

## Tech Stack
- **Backend**: Node.js + Express, PostgreSQL, JWT auth, bcrypt, connection pooling, DB indexing, rate limiting, pagination on everything
- **Frontend**: SwiftUI iOS app, URLSession + NetworkManager
- **Hosting**: Railway (backend + database)
- **Target**: Apple App Store

---

## Folder Structure
```
pollsplus/
├── CLAUDE.md                    # This file
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.js             # Express server entry point
│   │   ├── db/
│   │   │   ├── pool.js          # PostgreSQL connection pool
│   │   │   └── schema.sql       # Full database schema
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication middleware
│   │   │   └── rateLimit.js     # Rate limiting middleware
│   │   ├── routes/
│   │   │   ├── auth.js          # Register, login
│   │   │   ├── users.js         # Profiles, follow, block, report
│   │   │   ├── debates.js       # CRUD debates, vote, delete vote
│   │   │   ├── feeds.js         # All feed types
│   │   │   ├── communities.js   # CRUD communities, join, leave, approve
│   │   │   └── notifications.js # Notification endpoints
│   │   └── utils/
│   │       └── helpers.js       # Shared utility functions
│   └── tests/
│       └── api.test.js          # API integration tests
└── ios-app/                     # SwiftUI Xcode project (built later)
```

---

## Database Schema

### Tables
1. **users** — id, username, email, password_hash, category, created_at, updated_at
2. **debates** — id, user_id, community_id (nullable), title (nullable), category, created_at
3. **debate_options** — id, debate_id, label, position
4. **votes** — id, user_id, debate_id, option_id, created_at
5. **follows** — id, follower_id, following_id, created_at
6. **blocks** — id, blocker_id, blocked_id, created_at
7. **reports** — id, reporter_id, reported_user_id (nullable), reported_debate_id (nullable), reason, created_at
8. **communities** — id, name, category, founder_id, is_private, created_at
9. **community_members** — id, community_id, user_id, status (member/pending), joined_at
10. **seen_posts** — id, user_id, debate_id, created_at
11. **notifications** — id, user_id, type, from_user_id, read, created_at

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login, get JWT

### Users
- `GET /api/users/:id` — Get user profile
- `GET /api/users/:id/debates` — Get user's debates (paginated)
- `POST /api/users/:id/follow` — Follow user
- `DELETE /api/users/:id/follow` — Unfollow user
- `GET /api/users/:id/following` — List who user follows
- `GET /api/users/:id/followers` — List user's followers
- `POST /api/users/:id/block` — Block user
- `DELETE /api/users/:id/block` — Unblock user
- `POST /api/users/:id/report` — Report user

### Debates
- `POST /api/debates` — Create debate
- `GET /api/debates/:id` — Get single debate
- `DELETE /api/debates/:id` — Delete debate (owner or community founder)
- `POST /api/debates/:id/vote` — Vote on a debate
- `DELETE /api/debates/:id/vote` — Delete your vote
- `POST /api/debates/:id/report` — Report debate
- `POST /api/debates/:id/seen` — Mark debate as seen

### Feeds
- `GET /api/feeds/following` — Following feed
- `GET /api/feeds/communities` — My Communities feed
- `GET /api/feeds/category/:category` — Category feed (filters seen)
- `GET /api/feeds/popular` — Popular feed (filters seen)

### Communities
- `POST /api/communities` — Create community
- `GET /api/communities/:id` — Get community info
- `GET /api/communities/:id/debates` — Get community debates (paginated)
- `POST /api/communities/:id/join` — Join (or request to join)
- `DELETE /api/communities/:id/leave` — Leave community
- `GET /api/communities/:id/members` — List members
- `GET /api/communities/:id/pending` — List pending requests (founder only)
- `POST /api/communities/:id/approve/:userId` — Approve join request
- `DELETE /api/communities/:id/members/:userId` — Remove member (founder only)
- `DELETE /api/communities/:id/debates/:debateId` — Delete post (founder only)

### Notifications
- `GET /api/notifications` — Get notifications (paginated)
- `POST /api/notifications/read` — Mark all as read

### Browse
- `GET /api/communities/browse/:category` — Browse communities by category
