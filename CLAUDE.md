# PollsPlus — Complete Project Spec & Reference

## Core Concept
Social media app (iOS) where users scroll a feed of debates/polls and vote on them. Like TikTok/Twitter but the feed is scrollable debates. No images anywhere — category icons replace profile pictures with rich color-coded gradients.

## Categories
Sports, Movies, Video Games, Politics, Business/Tech, General.
Every user, post, and community is assigned one category. The category acts as the user/community avatar with unique colors:
- Sports = fiery orange-red, flame icon
- Movies = rich violet, popcorn icon
- Video Games = neon green, gamecontroller icon
- Politics = bold crimson, building columns icon
- Business/Tech = electric blue, cpu icon
- General = cool slate, sparkles icon

## Debates (Posts)
- Title (optional)
- 2 or more sides/options to vote on (creator chooses how many and names them)
- Before voting: see total vote count
- After voting: see each side's count and percentage with colored progress bars
- Users can delete their vote (only while voting is still open)
- One vote per user per debate
- **Voting deadline**: creator can set "Forever" (default) or pick a specific date/time. Expired debates show results but no longer accept votes. Expired debates hidden from Popular and Category feeds.
- **Comment count** displayed on each debate card
- **Community name** shown on card if posted to a community (links to that community)
- **Pin badge** shown if user has pinned the debate

## Comments & Replies
- Users can comment on any debate
- Reply to comments (threaded display)
- 1000 character limit per comment
- Tap comment bubble icon on debate card to expand/collapse comments
- Delete own comments, or debate author can delete any comment on their debate
- Deleting a parent comment cascades and removes all replies
- Blocked users' comments are hidden
- **Notifications**: "commented on your debate" and "replied to your comment"

## Pinning
- **Creator pins**: pin your own debates to the top of your profile
- **Voter pins**: pin debates you voted on to collect impressive predictions
- Pin/unpin from the ... menu on any debate you created or voted on
- "Pinned" tab on your profile shows all pinned debates
- Pin badge (category-colored circle with pin icon) appears on pinned debate cards

## Feeds
- **Popular** — algorithm: total_votes + 10 bonus if posted in last 24hrs. Filters out seen/voted posts. Hides expired debates.
- **Following** — posts from people you follow, newest first, no seen filter
- **Communities** — posts from communities you're in, newest first, no seen filter
- **Category feeds** — browse any of the 6 categories, filters seen/voted, hides expired
- Profile pages and community pages show ALL posts regardless
- Community posts appear in BOTH their community AND the matching category feed
- **Note**: Business/Tech requires special URL encoding (%2F for the slash) in API calls

## Communities
- Public or private (badge shown everywhere)
- Anyone can create one
- Public = anyone can join; Private = request to join, founder approves
- Each community has: name, category, founder, member count, public/private badge
- Members can post inside a community
- Posts inside a community still have their own category (the community's category)
- **Founder controls**:
  - Remove members
  - Delete posts
  - Toggle public/private (tap the lock badge)
  - Delete entire community (with confirmation)
  - View members list (founder only — hidden from everyone else)
  - View and approve pending join requests
- Communities browsed by category, sorted by most members first

## User Profiles
- Username, category icon as avatar (gradient circle with shadow), follower count, following count
- **4 tabs on own profile**: My Debates, Voted (with vote timestamps), Pinned, Communities
- Other users' profiles: just show their debates
- Tap any username anywhere to visit their profile
- **Change category**: pencil icon next to category badge on own profile
- **Delete account**: button on own profile with confirmation dialog (Apple requirement)
- **Logout**: button with confirmation dialog
- **Alerts**: bell icon in top-right of own profile, links to notifications page

## Privacy
- **Following list is private**: only you can see who you follow. Others see the count but can't tap to view the list. Backend returns 403 for non-owners.
- **Followers list is public**: anyone can see who follows someone
- **Community members list is private**: only the founder can see/manage members. Backend returns 403 for non-founders.
- Member count is still visible to everyone

## Social Features
- Follow/unfollow with correct button logic
- Block (completely hides each other, removes follows both directions)
- Report (flags post or user for admin review)
- **Notifications**: new followers, comments on your debates, replies to your comments
- Bell icon on profile page links to notifications

## Voting Rules
- One vote per user per debate
- Percentages and counts appear after voting with category-colored progress bars
- Remove vote option (only while voting is still open)
- Vote timestamp stored and displayed (e.g. "Voted Apr 7, 2026 at 3:45 PM")
- Voting blocked on expired debates (backend enforced)

## Seen Posts Tracking
- Track which posts each user has seen or voted on
- Filter these out of Category and Popular feeds
- Do NOT filter from Profile, Community, Following, or Communities feeds

## Search
- Search tab in main tab bar
- Searches users (by username), communities (by name), debates (by title)
- Live debounced search with 350ms delay
- Results grouped into People, Communities, Debates sections
- Block filtering applied to search results

## Tab Bar
Feed (flame icon) | Search | Post (+) | Groups (communities) | Profile

## Tech Stack
- **Backend**: Node.js + Express, PostgreSQL, JWT auth (30-day tokens), bcrypt, connection pooling, DB indexing, rate limiting, pagination on everything
- **Frontend**: SwiftUI iOS app (iOS 17+), URLSession + NetworkManager singleton
- **Database**: Supabase PostgreSQL (free tier) via session pooler (aws-1-us-west-2.pooler.supabase.com:5432)
- **Hosting**: Railway (backend server)
- **Analytics**: Firebase Analytics (tracks: sign_up, login, follow_user, create_debate, vote, create_community, join_community, post_comment)
- **Bundle ID**: com.timsmith.pollsplusapp
- **Target**: Apple App Store (already live)

## Database Connection
- Supabase PostgreSQL via session pooler
- Connection string format: `postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres`
- SSL: `{ rejectUnauthorized: false }`
- The DATABASE_URL env var on Railway must use the pooler URL (not the direct URL which is IPv6-only)

---

## Folder Structure
```
pollsplus/
├── CLAUDE.md                    # This file — full project reference
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   ├── railway.toml
│   ├── .env.example
│   ├── src/
│   │   ├── index.js             # Express server entry point
│   │   ├── db/
│   │   │   ├── pool.js          # PostgreSQL connection pool (Supabase)
│   │   │   └── schema.sql       # Full database schema
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication middleware
│   │   │   └── rateLimit.js     # Rate limiting middleware
│   │   ├── routes/
│   │   │   ├── auth.js          # Register, login
│   │   │   ├── users.js         # Profiles, follow, block, report, category, voted, pinned, communities, delete account
│   │   │   ├── debates.js       # CRUD debates, vote, delete vote, pin/unpin
│   │   │   ├── feeds.js         # All feed types (with seen/expired filtering)
│   │   │   ├── communities.js   # CRUD communities, join, leave, approve, delete, toggle privacy
│   │   │   ├── comments.js      # Comments and replies on debates
│   │   │   ├── notifications.js # Notification endpoints
│   │   │   └── search.js        # Search users, communities, debates
│   │   ├── utils/
│   │   │   └── helpers.js       # Shared utility functions
│   │   ├── seed.js              # Original seed script
│   │   └── seed-clean.js        # Clean seed script
│   └── tests/
│       └── api.test.js          # API integration tests
└── ios-app/
    ├── PollsPlus.xcodeproj/
    └── PollsPlus/
        ├── PollsPlusApp.swift           # App entry + Firebase init
        ├── GoogleService-Info.plist     # Firebase config
        ├── Assets.xcassets/
        ├── Models/
        │   └── Models.swift             # All data models (User, Debate, Comment, Community, etc.)
        ├── Services/
        │   └── NetworkManager.swift     # All API calls + Firebase analytics
        └── Views/
            ├── MainTabView.swift
            ├── Auth/
            │   ├── LoginView.swift      # Dark gradient login screen
            │   └── RegisterView.swift   # Category picker, styled inputs
            ├── Components/
            │   ├── CategoryIcon.swift   # Gradient circle avatar with shadow
            │   ├── DebateCard.swift     # Full debate card with voting, comments, pins, expiry
            │   └── CommentSection.swift # Threaded comments with replies
            ├── Feeds/
            │   ├── FeedView.swift       # Horizontal colored tab bar + feed content
            │   └── DebateListView.swift # Reusable paginated debate list
            ├── Debates/
            │   └── CreateDebateView.swift # Title, options, deadline picker, "Post to" category/community picker
            ├── Profile/
            │   ├── ProfileView.swift    # 4 tabs, change category, delete account, alerts button
            │   └── UserListView.swift   # Followers/following lists
            ├── Communities/
            │   ├── CommunitiesView.swift      # Browse by category
            │   ├── CommunityDetailView.swift  # Header, join/leave, founder controls, privacy toggle, delete
            │   ├── CreateCommunityView.swift
            │   └── MembersListView.swift      # Members + pending requests (founder only)
            ├── Notifications/
            │   └── NotificationsView.swift    # Follow, comment, reply notifications
            └── Search/
                └── SearchView.swift           # Search users, communities, debates
```

---

## Database Schema

### Tables (13 total)
1. **users** — id, username, email, password_hash, category, created_at, updated_at
2. **debates** — id, user_id, community_id (nullable), title (nullable), category, expires_at (nullable), created_at
3. **debate_options** — id, debate_id, label, position
4. **votes** — id, user_id, debate_id, option_id, created_at (used as vote timestamp)
5. **follows** — id, follower_id, following_id, created_at
6. **blocks** — id, blocker_id, blocked_id, created_at
7. **reports** — id, reporter_id, reported_user_id (nullable), reported_debate_id (nullable), reason, created_at
8. **communities** — id, name, category, founder_id, is_private, created_at
9. **community_members** — id, community_id, user_id, status (member/pending), joined_at
10. **seen_posts** — id, user_id, debate_id, created_at
11. **notifications** — id, user_id, type (new_follower/debate_comment/comment_reply), from_user_id, read, created_at
12. **pins** — id, user_id, debate_id, pin_type (voted/created), created_at, UNIQUE(user_id, debate_id)
13. **comments** — id, user_id, debate_id, parent_id (nullable, for replies), content, created_at

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account (returns user + JWT)
- `POST /api/auth/login` — Login (returns user + JWT)

### Users (note: /me/* routes MUST be defined before /:id routes in Express)
- `GET /api/users/me/voted` — Get debates current user voted on (with vote timestamps)
- `GET /api/users/me/pinned` — Get debates current user has pinned
- `GET /api/users/me/communities` — Get communities current user is a member of
- `PUT /api/users/me/category` — Update current user's category
- `DELETE /api/users/me` — Delete own account (cascades all data)
- `GET /api/users/:id` — Get user profile
- `GET /api/users/:id/debates` — Get user's debates (paginated)
- `POST /api/users/:id/follow` — Follow user
- `DELETE /api/users/:id/follow` — Unfollow user
- `GET /api/users/:id/following` — List who user follows (**private — owner only, 403 for others**)
- `GET /api/users/:id/followers` — List user's followers (public)
- `POST /api/users/:id/block` — Block user
- `DELETE /api/users/:id/block` — Unblock user
- `POST /api/users/:id/report` — Report user

### Debates
- `POST /api/debates` — Create debate (supports expires_at, community_id, returns comment_count + community_name)
- `GET /api/debates/:id` — Get single debate (includes my_vote_created_at, is_pinned, comment_count, community_name)
- `DELETE /api/debates/:id` — Delete debate (owner or community founder)
- `POST /api/debates/:id/vote` — Vote (blocked if expired)
- `DELETE /api/debates/:id/vote` — Delete your vote
- `POST /api/debates/:id/pin` — Pin debate (creator or voter only)
- `DELETE /api/debates/:id/pin` — Unpin debate
- `POST /api/debates/:id/report` — Report debate
- `POST /api/debates/:id/seen` — Mark debate as seen

### Comments
- `GET /api/debates/:debateId/comments` — Get top-level comments (with reply counts)
- `GET /api/debates/:debateId/comments/:commentId/replies` — Get replies to a comment
- `POST /api/debates/:debateId/comments` — Post comment or reply (triggers notifications)
- `DELETE /api/debates/:debateId/comments/:commentId` — Delete comment (author or debate owner)

### Feeds
- `GET /api/feeds/following` — Following feed (no seen filter)
- `GET /api/feeds/communities` — My Communities feed (no seen filter)
- `GET /api/feeds/category/:category` — Category feed (filters seen + expired)
- `GET /api/feeds/popular` — Popular feed (filters seen + expired, scored by votes + recency)

### Communities
- `POST /api/communities` — Create community
- `GET /api/communities/:id` — Get community info
- `GET /api/communities/:id/debates` — Get community debates (paginated, no seen filter)
- `POST /api/communities/:id/join` — Join (or request to join if private)
- `DELETE /api/communities/:id/leave` — Leave community
- `GET /api/communities/:id/members` — List members (**founder only, 403 for others**)
- `GET /api/communities/:id/pending` — List pending requests (founder only)
- `POST /api/communities/:id/approve/:userId` — Approve join request (founder only)
- `DELETE /api/communities/:id/members/:userId` — Remove member (founder only)
- `DELETE /api/communities/:id/debates/:debateId` — Delete post (founder only)
- `DELETE /api/communities/:id` — Delete community (founder only, removes all debates)
- `PUT /api/communities/:id/privacy` — Toggle public/private (founder only)

### Search
- `GET /api/search?q=term` — Search users, communities, and debates

### Notifications
- `GET /api/notifications` — Get notifications (paginated, includes unread_count)
- `POST /api/notifications/read` — Mark all as read

### Browse
- `GET /api/communities/browse/:category` — Browse communities by category (sorted by member count)

---

## Staging & Data Management

### Known accounts (safe to modify):
- **PollsPlusApp** (id: 44) — official app account, posts default content
- **user9107** (id: 56) — owner's account
- **Godzillaguy89** (id: 58) — family member
- **moviefan453** (id: 59) — family member
- **basketballquestions6545** (id: 60) — family member

### Rules for data management:
- NEVER modify any account not in the list above (except adding followers TO them from the 5 known accounts)
- All staging content (debates, votes, comments) should only come from these 5 accounts
- Fact-check all sports/current events content before adding (check actual current year NBA/NFL/Movies/etc.)
- PollsPlusApp debates should be backdated (7+ days old) so real user posts trend above them in Popular
- Clear seen_posts after adding content so feeds show fresh
- No same user commenting on the same post twice
- Comments should be specific and reference actual options, not generic ("knueppel shooting 42% from three as a rookie is insane" not "bro what")

### Database queries:
To query the live database, use:
```
DATABASE_URL="postgresql://postgres.ukmimprgjhpaprorbetc:MZp%2FMARy_vu%408fN@aws-1-us-west-2.pooler.supabase.com:5432/postgres"
```
Run from the `backend/` directory so `require('./src/db/pool')` works.

---

## Planned Next Update (Sunday)

### Demo-Mode / Signup Conversion Overhaul

**Problem:** 73% of downloaders bounce at the login screen without signing up. Firebase shows 30+ "new users" per ad but only 4-7 actual database signups.

**Solution:** Let users experience the app fully before committing to registration.

**Behavior:**
1. **No login/onboarding screen at app launch** — drop straight into the feed
2. Feed, communities, profiles, search — all content loads from backend normally
3. **First interaction** (vote, comment, post, follow, pin) triggers a personalized signup modal
   - Modal text references the specific debate: "Sign up to save your vote on '[debate title]'"
4. If dismissed with X, the app continues to work — but:
   - All write actions (vote, comment, post, follow, pin, block, report) return fake success states client-side only
   - Nothing is persisted to the backend
   - Local state updates so it *feels* real (vote counts go up, percentages show, etc.)
5. **Persistent top banner** on every screen: "Your votes and comments aren't being saved — Sign up free" with a tap-to-signup button
6. **Prominent Sign Up button** always visible somewhere obvious (top right of feed)
7. **Signup modal re-triggers** at natural moments — next vote, post attempt, tapping Profile, etc.
8. Once they register, `demoMode = false`, and everything from that point forward saves normally

### Technical Scope
- Add `demoMode` boolean flag to NetworkManager (default true until registered)
- Intercept all write endpoints when in demo mode — return fake success, update local state only
- Feed/read requests still go to real backend
- New persistent banner component at top of MainTabView
- New signup modal triggered after interactions
- On successful register → flip demoMode to false
- Log `demo_interaction` event to Firebase with counter (for funnel analysis later)
- Logged-in users (JWT in UserDefaults) skip demo mode entirely

### NOT in this update (future):
- Push notifications (requires APNs certificate setup in Apple Developer)
- Welcome push after signup (will use in-app celebration screen instead for now)

### Testing approach
- Simulator: **Device → Erase All Content and Settings** to simulate fresh install
- Hidden debug button to reset demo mode without erasing (for quick testing)
- Second simulator for parallel testing

---

## Known Issues & Future Ideas
- **No push notifications** — only in-app polling, no APNs integration yet
- **No email verification** — users can register with any email
- **No password reset** — no forgot password flow
- **No admin panel** — reports stored but no review UI
- **Future idea**: Hide vote percentages until deadline expires (blind voting reveal)
- **Future idea**: Daily featured poll, streaks, share cards for growth

---

## Current Status (as of last session)

- App is LIVE on App Store (bundle: com.timsmith.pollsplusapp)
- 22+ real users registered, ~2 returning daily
- ninjaone is most engaged (50+ votes, 2 debates, multiple sessions) — first real retention win
- Firebase Analytics wired up and tracking events
- Database is healthy, all 13 tables populated
- ~226 staged debates from PollsPlusApp backdated 7+ days so real user posts trend above them
- 33 communities seeded with content
- 5 known accounts (ids 44, 56, 58, 59, 60) follow every real user, with notifications dropped to encourage engagement
- **Next major update: demo mode / signup flow overhaul, scheduled for Sunday**
- **New ad campaign launching Monday after the update ships**
