const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

const BASE = process.env.TEST_URL || 'http://localhost:3000';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

let tokenA, tokenB, tokenC;
let userA, userB, userC;
let debateId, optionIds;
let communityId;

describe('PollsPlus API Tests', () => {

  // ===================== AUTH =====================
  describe('Auth', () => {
    it('should register user A', async () => {
      const { status, data } = await api('POST', '/api/auth/register', {
        username: 'alice', email: 'alice@test.com', password: 'password123', category: 'Sports',
      });
      assert.strictEqual(status, 201);
      assert.ok(data.token);
      assert.strictEqual(data.user.username, 'alice');
      tokenA = data.token;
      userA = data.user;
    });

    it('should register user B', async () => {
      const { status, data } = await api('POST', '/api/auth/register', {
        username: 'bob', email: 'bob@test.com', password: 'password123', category: 'Movies',
      });
      assert.strictEqual(status, 201);
      tokenB = data.token;
      userB = data.user;
    });

    it('should register user C', async () => {
      const { status, data } = await api('POST', '/api/auth/register', {
        username: 'charlie', email: 'charlie@test.com', password: 'password123', category: 'Politics',
      });
      assert.strictEqual(status, 201);
      tokenC = data.token;
      userC = data.user;
    });

    it('should reject duplicate username', async () => {
      const { status } = await api('POST', '/api/auth/register', {
        username: 'alice', email: 'other@test.com', password: 'password123',
      });
      assert.strictEqual(status, 409);
    });

    it('should login', async () => {
      const { status, data } = await api('POST', '/api/auth/login', {
        email: 'alice@test.com', password: 'password123',
      });
      assert.strictEqual(status, 200);
      assert.ok(data.token);
    });

    it('should reject bad password', async () => {
      const { status } = await api('POST', '/api/auth/login', {
        email: 'alice@test.com', password: 'wrong',
      });
      assert.strictEqual(status, 401);
    });
  });

  // ===================== USER PROFILES =====================
  describe('Users', () => {
    it('should get user profile', async () => {
      const { status, data } = await api('GET', `/api/users/${userA.id}`, null, tokenA);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.username, 'alice');
      assert.strictEqual(data.follower_count, 0);
    });

    it('should require auth', async () => {
      const { status } = await api('GET', `/api/users/${userA.id}`);
      assert.strictEqual(status, 401);
    });
  });

  // ===================== FOLLOW / UNFOLLOW =====================
  describe('Follow', () => {
    it('should follow user', async () => {
      const { status } = await api('POST', `/api/users/${userB.id}/follow`, null, tokenA);
      assert.strictEqual(status, 200);
    });

    it('should show in profile follower count', async () => {
      const { data } = await api('GET', `/api/users/${userB.id}`, null, tokenA);
      assert.strictEqual(data.follower_count, 1);
      assert.strictEqual(data.is_following, true);
    });

    it('should list following', async () => {
      const { data } = await api('GET', `/api/users/${userA.id}/following`, null, tokenA);
      assert.strictEqual(data.users.length, 1);
      assert.strictEqual(data.users[0].username, 'bob');
    });

    it('should list followers', async () => {
      const { data } = await api('GET', `/api/users/${userB.id}/followers`, null, tokenB);
      assert.strictEqual(data.users.length, 1);
      assert.strictEqual(data.users[0].username, 'alice');
    });

    it('should unfollow', async () => {
      await api('DELETE', `/api/users/${userB.id}/follow`, null, tokenA);
      const { data } = await api('GET', `/api/users/${userB.id}`, null, tokenA);
      assert.strictEqual(data.follower_count, 0);
      assert.strictEqual(data.is_following, false);
    });

    it('should not follow self', async () => {
      const { status } = await api('POST', `/api/users/${userA.id}/follow`, null, tokenA);
      assert.strictEqual(status, 400);
    });
  });

  // ===================== BLOCK =====================
  describe('Block', () => {
    it('should block user', async () => {
      // First follow, then block — follow should be removed
      await api('POST', `/api/users/${userC.id}/follow`, null, tokenA);
      const { status } = await api('POST', `/api/users/${userC.id}/block`, null, tokenA);
      assert.strictEqual(status, 200);

      // Follow should be gone
      const { data } = await api('GET', `/api/users/${userA.id}/following`, null, tokenA);
      const found = data.users.find(u => u.id === userC.id);
      assert.strictEqual(found, undefined);
    });

    it('should prevent following blocked user', async () => {
      const { status } = await api('POST', `/api/users/${userC.id}/follow`, null, tokenA);
      assert.strictEqual(status, 403);
    });

    it('should unblock user', async () => {
      const { status } = await api('DELETE', `/api/users/${userC.id}/block`, null, tokenA);
      assert.strictEqual(status, 200);
    });
  });

  // ===================== DEBATES =====================
  describe('Debates', () => {
    it('should create a debate', async () => {
      const { status, data } = await api('POST', '/api/debates', {
        title: 'Best sport?', category: 'Sports', options: ['Football', 'Basketball', 'Soccer'],
      }, tokenA);
      assert.strictEqual(status, 201);
      assert.strictEqual(data.title, 'Best sport?');
      assert.strictEqual(data.options.length, 3);
      assert.strictEqual(data.total_votes, 0);
      debateId = data.id;
      optionIds = data.options.map(o => o.id);
    });

    it('should require at least 2 options', async () => {
      const { status } = await api('POST', '/api/debates', {
        category: 'Sports', options: ['Only one'],
      }, tokenA);
      assert.strictEqual(status, 400);
    });

    it('should get debate', async () => {
      const { status, data } = await api('GET', `/api/debates/${debateId}`, null, tokenA);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.total_votes, 0);
      assert.strictEqual(data.my_vote_option_id, null);
    });

    it('should vote on debate', async () => {
      const { status } = await api('POST', `/api/debates/${debateId}/vote`, { option_id: optionIds[0] }, tokenA);
      assert.strictEqual(status, 200);
    });

    it('should show vote results after voting', async () => {
      const { data } = await api('GET', `/api/debates/${debateId}`, null, tokenA);
      assert.strictEqual(data.total_votes, 1);
      assert.strictEqual(data.my_vote_option_id, optionIds[0]);
      const votedOption = data.options.find(o => o.id === optionIds[0]);
      assert.strictEqual(votedOption.vote_count, 1);
    });

    it('should not double vote', async () => {
      const { status } = await api('POST', `/api/debates/${debateId}/vote`, { option_id: optionIds[1] }, tokenA);
      assert.strictEqual(status, 409);
    });

    it('should delete vote', async () => {
      const { status } = await api('DELETE', `/api/debates/${debateId}/vote`, null, tokenA);
      assert.strictEqual(status, 200);

      const { data } = await api('GET', `/api/debates/${debateId}`, null, tokenA);
      assert.strictEqual(data.total_votes, 0);
      assert.strictEqual(data.my_vote_option_id, null);
    });

    it('should delete debate (owner)', async () => {
      // Create then delete
      const { data: d } = await api('POST', '/api/debates', {
        title: 'Temp', category: 'General', options: ['A', 'B'],
      }, tokenA);
      const { status } = await api('DELETE', `/api/debates/${d.id}`, null, tokenA);
      assert.strictEqual(status, 200);
    });

    it('should not let others delete', async () => {
      const { status } = await api('DELETE', `/api/debates/${debateId}`, null, tokenB);
      assert.strictEqual(status, 403);
    });
  });

  // ===================== FEEDS =====================
  describe('Feeds', () => {
    it('should return following feed', async () => {
      // A follows B, B posts a debate
      await api('POST', `/api/users/${userB.id}/follow`, null, tokenA);
      await api('POST', '/api/debates', {
        title: 'Best movie?', category: 'Movies', options: ['Inception', 'Interstellar'],
      }, tokenB);

      const { status, data } = await api('GET', '/api/feeds/following', null, tokenA);
      assert.strictEqual(status, 200);
      assert.ok(data.debates.length >= 1);
    });

    it('should return category feed (filters seen)', async () => {
      // Mark the Sports debate as seen
      await api('POST', `/api/debates/${debateId}/seen`, null, tokenB);

      const { data } = await api('GET', '/api/feeds/category/Sports', null, tokenB);
      // Should not include debateId since we marked it seen
      const found = data.debates.find(d => d.id === debateId);
      assert.strictEqual(found, undefined);
    });

    it('should return popular feed', async () => {
      const { status, data } = await api('GET', '/api/feeds/popular', null, tokenC);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.debates));
    });
  });

  // ===================== COMMUNITIES =====================
  describe('Communities', () => {
    it('should create a public community', async () => {
      const { status, data } = await api('POST', '/api/communities', {
        name: 'Football Fans', category: 'Sports', is_private: false,
      }, tokenA);
      assert.strictEqual(status, 201);
      assert.strictEqual(data.member_count, 1);
      assert.strictEqual(data.is_founder, true);
      communityId = data.id;
    });

    it('should join public community', async () => {
      const { status, data } = await api('POST', `/api/communities/${communityId}/join`, null, tokenB);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.status, 'member');
    });

    it('should get community info', async () => {
      const { data } = await api('GET', `/api/communities/${communityId}`, null, tokenA);
      assert.strictEqual(data.name, 'Football Fans');
      assert.strictEqual(data.member_count, 2);
    });

    it('should post in community', async () => {
      const { status, data } = await api('POST', '/api/debates', {
        title: 'NFL or College?', category: 'Sports', options: ['NFL', 'College'],
        community_id: communityId,
      }, tokenB);
      assert.strictEqual(status, 201);
      assert.strictEqual(data.community_id, communityId);
    });

    it('should list community debates', async () => {
      const { data } = await api('GET', `/api/communities/${communityId}/debates`, null, tokenA);
      assert.ok(data.debates.length >= 1);
    });

    it('should list members', async () => {
      const { data } = await api('GET', `/api/communities/${communityId}/members`, null, tokenA);
      assert.strictEqual(data.members.length, 2);
    });

    it('should remove member (founder)', async () => {
      const { status } = await api('DELETE', `/api/communities/${communityId}/members/${userB.id}`, null, tokenA);
      assert.strictEqual(status, 200);
    });

    it('should leave community', async () => {
      // B rejoins then leaves
      await api('POST', `/api/communities/${communityId}/join`, null, tokenB);
      const { status } = await api('DELETE', `/api/communities/${communityId}/leave`, null, tokenB);
      assert.strictEqual(status, 200);
    });

    it('should browse by category', async () => {
      const { status, data } = await api('GET', '/api/communities/browse/Sports', null, tokenA);
      assert.strictEqual(status, 200);
      assert.ok(data.communities.length >= 1);
    });
  });

  // ===================== PRIVATE COMMUNITY =====================
  describe('Private Community', () => {
    let privateCommunityId;

    it('should create private community', async () => {
      const { data } = await api('POST', '/api/communities', {
        name: 'Secret Club', category: 'General', is_private: true,
      }, tokenA);
      privateCommunityId = data.id;
    });

    it('should set pending status for private join', async () => {
      const { data } = await api('POST', `/api/communities/${privateCommunityId}/join`, null, tokenB);
      assert.strictEqual(data.status, 'pending');
    });

    it('should list pending requests', async () => {
      const { data } = await api('GET', `/api/communities/${privateCommunityId}/pending`, null, tokenA);
      assert.strictEqual(data.pending.length, 1);
    });

    it('should approve request', async () => {
      const { status } = await api('POST', `/api/communities/${privateCommunityId}/approve/${userB.id}`, null, tokenA);
      assert.strictEqual(status, 200);
    });

    it('should now show as member', async () => {
      const { data } = await api('GET', `/api/communities/${privateCommunityId}`, null, tokenB);
      assert.strictEqual(data.is_member, true);
    });
  });

  // ===================== NOTIFICATIONS =====================
  describe('Notifications', () => {
    it('should have follow notification', async () => {
      const { data } = await api('GET', '/api/notifications', null, tokenB);
      assert.ok(data.notifications.length >= 1);
      assert.ok(data.unread_count >= 1);
    });

    it('should mark all as read', async () => {
      await api('POST', '/api/notifications/read', null, tokenB);
      const { data } = await api('GET', '/api/notifications', null, tokenB);
      assert.strictEqual(data.unread_count, 0);
    });
  });

  // ===================== REPORT =====================
  describe('Reports', () => {
    it('should report user', async () => {
      const { status } = await api('POST', `/api/users/${userC.id}/report`, { reason: 'Spam' }, tokenA);
      assert.strictEqual(status, 200);
    });

    it('should report debate', async () => {
      const { status } = await api('POST', `/api/debates/${debateId}/report`, { reason: 'Inappropriate' }, tokenB);
      assert.strictEqual(status, 200);
    });
  });

  // ===================== COMMUNITIES FEED =====================
  describe('Communities Feed', () => {
    it('should return community feed for member', async () => {
      const { status, data } = await api('GET', '/api/feeds/communities', null, tokenA);
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.debates));
    });
  });

  // ===================== USER DEBATES =====================
  describe('User Debates', () => {
    it('should list user debates', async () => {
      const { status, data } = await api('GET', `/api/users/${userA.id}/debates`, null, tokenA);
      assert.strictEqual(status, 200);
      assert.ok(data.debates.length >= 1);
    });
  });

  // ===================== HEALTH CHECK =====================
  describe('Health', () => {
    it('should return health', async () => {
      const res = await fetch(`${BASE}/health`);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
    });
  });
});
