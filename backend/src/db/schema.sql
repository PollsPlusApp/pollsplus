-- PollsPlus Database Schema
-- Run with: psql $DATABASE_URL -f src/db/schema.sql

-- Category enum used across multiple tables
CREATE TYPE category_enum AS ENUM ('Sports', 'Movies', 'Video Games', 'Politics', 'Business/Tech', 'General');

-- Community member status
CREATE TYPE member_status AS ENUM ('member', 'pending');

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    category category_enum NOT NULL DEFAULT 'General',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);

-- ============================================
-- COMMUNITIES
-- ============================================
CREATE TABLE communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category category_enum NOT NULL,
    founder_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communities_category ON communities (category);
CREATE INDEX idx_communities_founder ON communities (founder_id);

-- ============================================
-- COMMUNITY MEMBERS
-- ============================================
CREATE TABLE community_members (
    id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status member_status NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

CREATE INDEX idx_community_members_community ON community_members (community_id);
CREATE INDEX idx_community_members_user ON community_members (user_id);
CREATE INDEX idx_community_members_status ON community_members (community_id, status);

-- ============================================
-- DEBATES (POSTS)
-- ============================================
CREATE TABLE debates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    title VARCHAR(300),
    category category_enum NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debates_user ON debates (user_id);
CREATE INDEX idx_debates_community ON debates (community_id);
CREATE INDEX idx_debates_category ON debates (category);
CREATE INDEX idx_debates_created ON debates (created_at DESC);
CREATE INDEX idx_debates_category_created ON debates (category, created_at DESC);

-- ============================================
-- DEBATE OPTIONS (SIDES)
-- ============================================
CREATE TABLE debate_options (
    id SERIAL PRIMARY KEY,
    debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    label VARCHAR(200) NOT NULL,
    position INTEGER NOT NULL
);

CREATE INDEX idx_debate_options_debate ON debate_options (debate_id);

-- ============================================
-- VOTES
-- ============================================
CREATE TABLE votes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES debate_options(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, debate_id)
);

CREATE INDEX idx_votes_debate ON votes (debate_id);
CREATE INDEX idx_votes_option ON votes (option_id);
CREATE INDEX idx_votes_user ON votes (user_id);

-- ============================================
-- FOLLOWS
-- ============================================
CREATE TABLE follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows (follower_id);
CREATE INDEX idx_follows_following ON follows (following_id);

-- ============================================
-- BLOCKS
-- ============================================
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);

-- ============================================
-- REPORTS
-- ============================================
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reported_debate_id INTEGER REFERENCES debates(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (reported_user_id IS NOT NULL OR reported_debate_id IS NOT NULL)
);

CREATE INDEX idx_reports_reporter ON reports (reporter_id);

-- ============================================
-- SEEN POSTS
-- ============================================
CREATE TABLE seen_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, debate_id)
);

CREATE INDEX idx_seen_posts_user ON seen_posts (user_id);
CREATE INDEX idx_seen_posts_user_debate ON seen_posts (user_id, debate_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id, read) WHERE read = false;

-- ============================================
-- PINS
-- ============================================
CREATE TABLE pins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    pin_type VARCHAR(20) NOT NULL CHECK (pin_type IN ('voted', 'created')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, debate_id)
);

CREATE INDEX idx_pins_user ON pins (user_id);
CREATE INDEX idx_pins_user_type ON pins (user_id, pin_type);

-- ============================================
-- COMMENTS
-- ============================================
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    debate_id INTEGER NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_debate ON comments (debate_id, created_at ASC);
CREATE INDEX idx_comments_parent ON comments (parent_id);
CREATE INDEX idx_comments_user ON comments (user_id);
