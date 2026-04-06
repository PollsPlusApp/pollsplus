require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db/pool');

const CATEGORIES = ['Sports', 'Movies', 'Video Games', 'Politics', 'Business/Tech', 'General'];

const USERS = [
  { username: 'SportsFanatic', email: 'sports@pollsplus.com', category: 'Sports' },
  { username: 'MovieBuff', email: 'movies@pollsplus.com', category: 'Movies' },
  { username: 'GamerPro', email: 'games@pollsplus.com', category: 'Video Games' },
  { username: 'PoliticalMind', email: 'politics@pollsplus.com', category: 'Politics' },
  { username: 'TechGuru', email: 'tech@pollsplus.com', category: 'Business/Tech' },
  { username: 'JustCurious', email: 'general@pollsplus.com', category: 'General' },
  { username: 'DebateKing', email: 'debateking@pollsplus.com', category: 'General' },
  { username: 'HotTakes', email: 'hottakes@pollsplus.com', category: 'Sports' },
  { username: 'CinemaLover', email: 'cinema@pollsplus.com', category: 'Movies' },
  { username: 'PixelHunter', email: 'pixel@pollsplus.com', category: 'Video Games' },
  { username: 'VoteQueen', email: 'votequeen@pollsplus.com', category: 'Politics' },
  { username: 'StartupLife', email: 'startup@pollsplus.com', category: 'Business/Tech' },
];

const COMMUNITIES = [
  { name: 'Sports Central', category: 'Sports', founder: 'SportsFanatic' },
  { name: 'Movie Club', category: 'Movies', founder: 'MovieBuff' },
  { name: 'Gamers United', category: 'Video Games', founder: 'GamerPro' },
  { name: 'Political Arena', category: 'Politics', founder: 'PoliticalMind' },
  { name: 'Tech & Business Hub', category: 'Business/Tech', founder: 'TechGuru' },
  { name: 'The Water Cooler', category: 'General', founder: 'JustCurious' },
];

const DEBATES = {
  Sports: [
    { title: 'Greatest basketball player of all time?', options: ['Michael Jordan', 'LeBron James', 'Kobe Bryant'], posters: ['SportsFanatic', 'HotTakes'] },
    { title: 'Better sport to watch?', options: ['Football', 'Basketball', 'Soccer', 'Baseball'], posters: ['HotTakes', 'SportsFanatic'] },
    { title: 'Who wins the Super Bowl this year?', options: ['Chiefs', '49ers', 'Eagles', 'Bills'], posters: ['SportsFanatic', 'DebateKing'] },
    { title: 'Best soccer league in the world?', options: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga'], posters: ['HotTakes'] },
    { title: 'Is golf a real sport?', options: ['Yes absolutely', 'No way'], posters: ['DebateKing'] },
    { title: 'Most exciting Olympic event?', options: ['100m Sprint', 'Swimming', 'Gymnastics', 'Basketball'], posters: ['SportsFanatic'] },
    { title: 'Better rivalry?', options: ['Lakers vs Celtics', 'Yankees vs Red Sox', 'Real Madrid vs Barcelona'], posters: ['HotTakes'] },
    { title: 'Should college athletes get paid?', options: ['Yes they deserve it', 'No keep it amateur', 'Only top performers'], posters: ['DebateKing', 'SportsFanatic'] },
    { title: 'Best tennis player ever?', options: ['Federer', 'Nadal', 'Djokovic'], posters: ['HotTakes'] },
    { title: 'Hardest sport to play?', options: ['Hockey', 'Water Polo', 'Boxing', 'Gymnastics'], posters: ['SportsFanatic'] },
    { title: 'Should the NBA shorten its season?', options: ['Yes fewer games', 'No keep 82 games'], posters: ['HotTakes'] },
    { title: 'Best stadium atmosphere?', options: ['College football', 'European soccer', 'NBA playoffs', 'NFL'], posters: ['DebateKing'] },
  ],
  Movies: [
    { title: 'Best movie franchise?', options: ['Marvel', 'Star Wars', 'Lord of the Rings', 'Harry Potter'], posters: ['MovieBuff', 'CinemaLover'] },
    { title: 'Greatest director of all time?', options: ['Spielberg', 'Scorsese', 'Kubrick', 'Nolan'], posters: ['CinemaLover'] },
    { title: 'Best movie of the 2020s so far?', options: ['Oppenheimer', 'Everything Everywhere', 'Top Gun Maverick', 'Dune'], posters: ['MovieBuff'] },
    { title: 'Scariest horror movie?', options: ['The Exorcist', 'Hereditary', 'The Shining', 'Get Out'], posters: ['CinemaLover', 'MovieBuff'] },
    { title: 'Better Batman?', options: ['Christian Bale', 'Robert Pattinson', 'Ben Affleck', 'Michael Keaton'], posters: ['MovieBuff'] },
    { title: 'Are superhero movies overrated?', options: ['Yes way too many', 'No they are great', 'Some are some arent'], posters: ['DebateKing'] },
    { title: 'Best animated movie studio?', options: ['Pixar', 'Studio Ghibli', 'DreamWorks', 'Disney'], posters: ['CinemaLover'] },
    { title: 'Sequels that were better than the original?', options: ['The Dark Knight', 'Terminator 2', 'Aliens', 'Empire Strikes Back'], posters: ['MovieBuff'] },
    { title: 'Best movie soundtrack?', options: ['Interstellar', 'Inception', 'The Lion King', 'Guardians of the Galaxy'], posters: ['CinemaLover'] },
    { title: 'Theater or streaming?', options: ['Theater always', 'Streaming at home', 'Depends on the movie'], posters: ['MovieBuff', 'DebateKing'] },
    { title: 'Most overrated movie?', options: ['Avatar', 'Titanic', 'The Godfather', 'Forrest Gump'], posters: ['CinemaLover'] },
    { title: 'Best plot twist in a movie?', options: ['Sixth Sense', 'Fight Club', 'Usual Suspects', 'Shutter Island'], posters: ['MovieBuff'] },
  ],
  'Video Games': [
    { title: 'Best gaming console?', options: ['PS5', 'Xbox Series X', 'Nintendo Switch', 'PC'], posters: ['GamerPro', 'PixelHunter'] },
    { title: 'Game of the year?', options: ['Zelda TOTK', 'Baldurs Gate 3', 'Elden Ring', 'God of War Ragnarok'], posters: ['PixelHunter'] },
    { title: 'Best multiplayer game?', options: ['Fortnite', 'Call of Duty', 'Minecraft', 'Valorant'], posters: ['GamerPro'] },
    { title: 'Better open world?', options: ['GTA V', 'Red Dead 2', 'Breath of the Wild', 'Skyrim'], posters: ['PixelHunter', 'GamerPro'] },
    { title: 'Most iconic video game character?', options: ['Mario', 'Master Chief', 'Link', 'Kratos'], posters: ['GamerPro'] },
    { title: 'Are microtransactions ruining gaming?', options: ['Yes completely', 'Only pay to win ones', 'No its fine'], posters: ['DebateKing', 'PixelHunter'] },
    { title: 'Best RPG of all time?', options: ['Witcher 3', 'Skyrim', 'Final Fantasy VII', 'Baldurs Gate 3'], posters: ['PixelHunter'] },
    { title: 'Mobile gaming is real gaming?', options: ['Yes', 'No', 'Depends on the game'], posters: ['GamerPro'] },
    { title: 'Best battle royale?', options: ['Fortnite', 'Apex Legends', 'Warzone', 'PUBG'], posters: ['PixelHunter'] },
    { title: 'Most anticipated upcoming game?', options: ['GTA VI', 'Elder Scrolls VI', 'Metroid Prime 4', 'Hollow Knight Silksong'], posters: ['GamerPro', 'PixelHunter'] },
    { title: 'Best horror game?', options: ['Resident Evil 4', 'Silent Hill 2', 'Dead Space', 'Outlast'], posters: ['PixelHunter'] },
    { title: 'Single player or multiplayer?', options: ['Single player story', 'Multiplayer with friends', 'Both equally'], posters: ['GamerPro'] },
  ],
  Politics: [
    { title: 'Most important issue right now?', options: ['Economy', 'Healthcare', 'Climate', 'Immigration'], posters: ['PoliticalMind', 'VoteQueen'] },
    { title: 'Should voting be mandatory?', options: ['Yes for everyone', 'No its a choice', 'Only for major elections'], posters: ['VoteQueen'] },
    { title: 'Best form of government?', options: ['Democracy', 'Constitutional Republic', 'Parliamentary', 'Direct Democracy'], posters: ['PoliticalMind'] },
    { title: 'Should the voting age be lowered to 16?', options: ['Yes they are informed enough', 'No keep it at 18', 'Maybe for local elections'], posters: ['VoteQueen', 'DebateKing'] },
    { title: 'Term limits for Congress?', options: ['Absolutely yes', 'No experience matters', '12 year max'], posters: ['PoliticalMind'] },
    { title: 'Biggest challenge for the next generation?', options: ['Climate change', 'AI and jobs', 'Housing costs', 'National debt'], posters: ['VoteQueen'] },
    { title: 'Social media regulation?', options: ['More regulation needed', 'Keep it free', 'Only for minors'], posters: ['PoliticalMind', 'DebateKing'] },
    { title: 'Universal basic income?', options: ['Great idea', 'Terrible idea', 'Worth a trial'], posters: ['VoteQueen'] },
    { title: 'Best way to reduce crime?', options: ['More police', 'Better education', 'Economic opportunity', 'Community programs'], posters: ['PoliticalMind'] },
    { title: 'Should Election Day be a national holiday?', options: ['Yes definitely', 'No not necessary', 'Make it a week'], posters: ['VoteQueen'] },
    { title: 'Space exploration funding?', options: ['Increase it', 'Keep it the same', 'Redirect to Earth problems'], posters: ['DebateKing'] },
    { title: 'Free college for everyone?', options: ['Yes', 'No', 'Only community college', 'Income based'], posters: ['PoliticalMind'] },
  ],
  'Business/Tech': [
    { title: 'Best tech company to work for?', options: ['Apple', 'Google', 'Microsoft', 'Meta'], posters: ['TechGuru', 'StartupLife'] },
    { title: 'Will AI replace most jobs?', options: ['Yes within 20 years', 'No it will create new ones', 'Only repetitive jobs'], posters: ['TechGuru'] },
    { title: 'Best programming language?', options: ['Python', 'JavaScript', 'Rust', 'Go'], posters: ['StartupLife'] },
    { title: 'Remote work or office?', options: ['Fully remote', 'Hybrid', 'Office all the way'], posters: ['TechGuru', 'StartupLife'] },
    { title: 'Best investment right now?', options: ['Tech stocks', 'Real estate', 'Crypto', 'Index funds'], posters: ['StartupLife'] },
    { title: 'Most innovative company?', options: ['Tesla', 'Apple', 'OpenAI', 'SpaceX'], posters: ['TechGuru'] },
    { title: 'Startup or big company?', options: ['Startup for growth', 'Big company for stability', 'Depends on stage of life'], posters: ['StartupLife', 'DebateKing'] },
    { title: 'Best laptop?', options: ['MacBook Pro', 'ThinkPad', 'Dell XPS', 'Framework'], posters: ['TechGuru'] },
    { title: 'Will crypto recover?', options: ['Yes to new highs', 'It will stabilize', 'Its dead'], posters: ['StartupLife'] },
    { title: 'Most important skill to learn?', options: ['Coding', 'AI and ML', 'Sales', 'Public speaking'], posters: ['TechGuru'] },
    { title: 'Best cloud platform?', options: ['AWS', 'Google Cloud', 'Azure', 'Vercel'], posters: ['StartupLife'] },
    { title: 'Should big tech be broken up?', options: ['Yes too powerful', 'No let them compete', 'Only some of them'], posters: ['DebateKing'] },
  ],
  General: [
    { title: 'Best season?', options: ['Spring', 'Summer', 'Fall', 'Winter'], posters: ['JustCurious', 'DebateKing'] },
    { title: 'Morning person or night owl?', options: ['Early bird', 'Night owl', 'Depends on the day'], posters: ['JustCurious'] },
    { title: 'Best social media platform?', options: ['Instagram', 'TikTok', 'Twitter/X', 'YouTube'], posters: ['DebateKing'] },
    { title: 'Cats or dogs?', options: ['Dogs', 'Cats', 'Both', 'Neither'], posters: ['JustCurious', 'DebateKing'] },
    { title: 'Best fast food?', options: ['Chick-fil-A', 'McDonalds', 'In-N-Out', 'Wendys'], posters: ['JustCurious'] },
    { title: 'Coffee or tea?', options: ['Coffee', 'Tea', 'Both', 'Neither'], posters: ['DebateKing'] },
    { title: 'Best way to spend a weekend?', options: ['Outdoors adventure', 'Netflix and chill', 'Hanging with friends', 'Solo hobbies'], posters: ['JustCurious'] },
    { title: 'Pineapple on pizza?', options: ['Yes its amazing', 'No its a crime', 'Only with ham'], posters: ['DebateKing', 'JustCurious'] },
    { title: 'Best music genre?', options: ['Hip Hop', 'Pop', 'Rock', 'R&B'], posters: ['JustCurious'] },
    { title: 'Would you rather be famous or rich?', options: ['Famous', 'Rich', 'Both', 'Neither just happy'], posters: ['DebateKing'] },
    { title: 'Ideal vacation?', options: ['Beach resort', 'Mountain cabin', 'City trip', 'Road trip'], posters: ['JustCurious'] },
    { title: 'Is cereal a soup?', options: ['Yes technically', 'Absolutely not', 'I never thought about it'], posters: ['DebateKing'] },
  ],
};

async function seed() {
  console.log('Starting seed...');

  // 1. Create users
  const passwordHash = await bcrypt.hash('PollsPlus2024!', 10);
  const userIds = {};

  for (const u of USERS) {
    try {
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, category) VALUES ($1, $2, $3, $4) RETURNING id',
        [u.username, u.email, passwordHash, u.category]
      );
      userIds[u.username] = result.rows[0].id;
      console.log(`  Created user: ${u.username} (id: ${result.rows[0].id})`);
    } catch (err) {
      if (err.code === '23505') {
        const existing = await pool.query('SELECT id FROM users WHERE username = $1', [u.username]);
        userIds[u.username] = existing.rows[0].id;
        console.log(`  User exists: ${u.username} (id: ${existing.rows[0].id})`);
      } else throw err;
    }
  }

  // 2. Have users follow each other
  const userNames = Object.keys(userIds);
  for (const follower of userNames) {
    for (const following of userNames) {
      if (follower !== following && Math.random() > 0.4) {
        try {
          await pool.query(
            'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userIds[follower], userIds[following]]
          );
        } catch {}
      }
    }
  }
  console.log('  Created follow relationships');

  // 3. Create communities
  const communityIds = {};
  for (const c of COMMUNITIES) {
    try {
      const result = await pool.query(
        'INSERT INTO communities (name, category, founder_id, is_private) VALUES ($1, $2, $3, false) RETURNING id',
        [c.name, c.category, userIds[c.founder]]
      );
      communityIds[c.category] = result.rows[0].id;
      console.log(`  Created community: ${c.name} (id: ${result.rows[0].id})`);

      // Founder auto-joins
      await pool.query(
        "INSERT INTO community_members (community_id, user_id, status) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
        [result.rows[0].id, userIds[c.founder]]
      );

      // Add most other users as members
      for (const uName of userNames) {
        if (uName !== c.founder && Math.random() > 0.25) {
          try {
            await pool.query(
              "INSERT INTO community_members (community_id, user_id, status) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
              [result.rows[0].id, userIds[uName]]
            );
          } catch {}
        }
      }
    } catch (err) {
      if (err.code === '23505') {
        const existing = await pool.query("SELECT id FROM communities WHERE name = $1", [c.name]);
        communityIds[c.category] = existing.rows[0].id;
        console.log(`  Community exists: ${c.name}`);
      } else throw err;
    }
  }

  // 4. Create debates and votes
  let debateCount = 0;
  for (const [category, debates] of Object.entries(DEBATES)) {
    const communityId = communityIds[category];

    for (const d of debates) {
      const poster = d.posters[Math.floor(Math.random() * d.posters.length)];
      const posterId = userIds[poster];

      // Post to both the category feed AND the community
      const targets = [null]; // null = no community (goes to category feed)
      if (communityId) targets.push(communityId); // also post inside the community

      for (const targetCommunityId of targets) {
        try {
          // Stagger creation times so feed order looks natural
          const minutesAgo = Math.floor(Math.random() * 4320); // up to 3 days
          const createdAt = new Date(Date.now() - minutesAgo * 60000).toISOString();

          const debateResult = await pool.query(
            'INSERT INTO debates (user_id, community_id, title, category, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [posterId, targetCommunityId, d.title, category, createdAt]
          );
          const debateId = debateResult.rows[0].id;

          // Insert options
          for (let i = 0; i < d.options.length; i++) {
            await pool.query(
              'INSERT INTO debate_options (debate_id, label, position) VALUES ($1, $2, $3)',
              [debateId, d.options[i], i]
            );
          }

          // Get option IDs for voting
          const optionsResult = await pool.query(
            'SELECT id, position FROM debate_options WHERE debate_id = $1 ORDER BY position',
            [debateId]
          );
          const optionIds = optionsResult.rows.map(r => r.id);

          // Random votes from users
          for (const voterName of userNames) {
            if (voterName !== poster && Math.random() > 0.35) {
              const randomOption = optionIds[Math.floor(Math.random() * optionIds.length)];
              try {
                await pool.query(
                  'INSERT INTO votes (user_id, debate_id, option_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                  [userIds[voterName], debateId, randomOption]
                );
              } catch {}
            }
          }

          debateCount++;
        } catch (err) {
          if (err.code !== '23505') console.error(`  Error creating debate: ${err.message}`);
        }
      }
    }
  }

  console.log(`  Created ${debateCount} debates with votes`);
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
