require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db/pool');

const COMMUNITIES = [
  { name: 'Sports Community', category: 'Sports' },
  { name: 'Movies Community', category: 'Movies' },
  { name: 'Video Games Community', category: 'Video Games' },
  { name: 'Politics Community', category: 'Politics' },
  { name: 'Business/Tech Community', category: 'Business/Tech' },
  { name: 'General Community', category: 'General' },
];

const DEBATES = {
  Sports: [
    { title: 'Greatest basketball player of all time?', options: ['Michael Jordan', 'LeBron James', 'Kobe Bryant'] },
    { title: 'Better sport to watch?', options: ['Football', 'Basketball', 'Soccer', 'Baseball'] },
    { title: 'Who wins the Super Bowl this year?', options: ['Chiefs', '49ers', 'Eagles', 'Bills'] },
    { title: 'Best soccer league in the world?', options: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga'] },
    { title: 'Is golf a real sport?', options: ['Yes absolutely', 'No way'] },
    { title: 'Most exciting Olympic event?', options: ['100m Sprint', 'Swimming', 'Gymnastics', 'Basketball'] },
    { title: 'Better rivalry?', options: ['Lakers vs Celtics', 'Yankees vs Red Sox', 'Real Madrid vs Barcelona'] },
    { title: 'Should college athletes get paid?', options: ['Yes they deserve it', 'No keep it amateur', 'Only top performers'] },
    { title: 'Best tennis player ever?', options: ['Federer', 'Nadal', 'Djokovic'] },
    { title: 'Hardest sport to play?', options: ['Hockey', 'Water Polo', 'Boxing', 'Gymnastics'] },
    { title: 'Should the NBA shorten its season?', options: ['Yes fewer games', 'No keep 82 games'] },
    { title: 'Best stadium atmosphere?', options: ['College football', 'European soccer', 'NBA playoffs', 'NFL'] },
  ],
  Movies: [
    { title: 'Best movie franchise?', options: ['Marvel', 'Star Wars', 'Lord of the Rings', 'Harry Potter'] },
    { title: 'Greatest director of all time?', options: ['Spielberg', 'Scorsese', 'Kubrick', 'Nolan'] },
    { title: 'Best movie of the 2020s so far?', options: ['Oppenheimer', 'Everything Everywhere', 'Top Gun Maverick', 'Dune'] },
    { title: 'Scariest horror movie?', options: ['The Exorcist', 'Hereditary', 'The Shining', 'Get Out'] },
    { title: 'Better Batman?', options: ['Christian Bale', 'Robert Pattinson', 'Ben Affleck', 'Michael Keaton'] },
    { title: 'Are superhero movies overrated?', options: ['Yes way too many', 'No they are great', 'Some are some arent'] },
    { title: 'Best animated movie studio?', options: ['Pixar', 'Studio Ghibli', 'DreamWorks', 'Disney'] },
    { title: 'Sequels that were better than the original?', options: ['The Dark Knight', 'Terminator 2', 'Aliens', 'Empire Strikes Back'] },
    { title: 'Best movie soundtrack?', options: ['Interstellar', 'Inception', 'The Lion King', 'Guardians of the Galaxy'] },
    { title: 'Theater or streaming?', options: ['Theater always', 'Streaming at home', 'Depends on the movie'] },
    { title: 'Most overrated movie?', options: ['Avatar', 'Titanic', 'The Godfather', 'Forrest Gump'] },
    { title: 'Best plot twist in a movie?', options: ['Sixth Sense', 'Fight Club', 'Usual Suspects', 'Shutter Island'] },
  ],
  'Video Games': [
    { title: 'Best gaming console?', options: ['PS5', 'Xbox Series X', 'Nintendo Switch', 'PC'] },
    { title: 'Game of the year?', options: ['Zelda TOTK', 'Baldurs Gate 3', 'Elden Ring', 'God of War Ragnarok'] },
    { title: 'Best multiplayer game?', options: ['Fortnite', 'Call of Duty', 'Minecraft', 'Valorant'] },
    { title: 'Better open world?', options: ['GTA V', 'Red Dead 2', 'Breath of the Wild', 'Skyrim'] },
    { title: 'Most iconic video game character?', options: ['Mario', 'Master Chief', 'Link', 'Kratos'] },
    { title: 'Are microtransactions ruining gaming?', options: ['Yes completely', 'Only pay to win ones', 'No its fine'] },
    { title: 'Best RPG of all time?', options: ['Witcher 3', 'Skyrim', 'Final Fantasy VII', 'Baldurs Gate 3'] },
    { title: 'Mobile gaming is real gaming?', options: ['Yes', 'No', 'Depends on the game'] },
    { title: 'Best battle royale?', options: ['Fortnite', 'Apex Legends', 'Warzone', 'PUBG'] },
    { title: 'Most anticipated upcoming game?', options: ['GTA VI', 'Elder Scrolls VI', 'Metroid Prime 4', 'Hollow Knight Silksong'] },
    { title: 'Best horror game?', options: ['Resident Evil 4', 'Silent Hill 2', 'Dead Space', 'Outlast'] },
    { title: 'Single player or multiplayer?', options: ['Single player story', 'Multiplayer with friends', 'Both equally'] },
  ],
  Politics: [
    { title: 'Most important issue right now?', options: ['Economy', 'Healthcare', 'Climate', 'Immigration'] },
    { title: 'Should voting be mandatory?', options: ['Yes for everyone', 'No its a choice', 'Only for major elections'] },
    { title: 'Best form of government?', options: ['Democracy', 'Constitutional Republic', 'Parliamentary', 'Direct Democracy'] },
    { title: 'Should the voting age be lowered to 16?', options: ['Yes they are informed enough', 'No keep it at 18', 'Maybe for local elections'] },
    { title: 'Term limits for Congress?', options: ['Absolutely yes', 'No experience matters', '12 year max'] },
    { title: 'Biggest challenge for the next generation?', options: ['Climate change', 'AI and jobs', 'Housing costs', 'National debt'] },
    { title: 'Social media regulation?', options: ['More regulation needed', 'Keep it free', 'Only for minors'] },
    { title: 'Universal basic income?', options: ['Great idea', 'Terrible idea', 'Worth a trial'] },
    { title: 'Best way to reduce crime?', options: ['More police', 'Better education', 'Economic opportunity', 'Community programs'] },
    { title: 'Should Election Day be a national holiday?', options: ['Yes definitely', 'No not necessary', 'Make it a week'] },
    { title: 'Space exploration funding?', options: ['Increase it', 'Keep it the same', 'Redirect to Earth problems'] },
    { title: 'Free college for everyone?', options: ['Yes', 'No', 'Only community college', 'Income based'] },
  ],
  'Business/Tech': [
    { title: 'Best tech company to work for?', options: ['Apple', 'Google', 'Microsoft', 'Meta'] },
    { title: 'Will AI replace most jobs?', options: ['Yes within 20 years', 'No it will create new ones', 'Only repetitive jobs'] },
    { title: 'Best programming language?', options: ['Python', 'JavaScript', 'Rust', 'Go'] },
    { title: 'Remote work or office?', options: ['Fully remote', 'Hybrid', 'Office all the way'] },
    { title: 'Best investment right now?', options: ['Tech stocks', 'Real estate', 'Crypto', 'Index funds'] },
    { title: 'Most innovative company?', options: ['Tesla', 'Apple', 'OpenAI', 'SpaceX'] },
    { title: 'Startup or big company?', options: ['Startup for growth', 'Big company for stability', 'Depends on stage of life'] },
    { title: 'Best laptop?', options: ['MacBook Pro', 'ThinkPad', 'Dell XPS', 'Framework'] },
    { title: 'Will crypto recover?', options: ['Yes to new highs', 'It will stabilize', 'Its dead'] },
    { title: 'Most important skill to learn?', options: ['Coding', 'AI and ML', 'Sales', 'Public speaking'] },
    { title: 'Best cloud platform?', options: ['AWS', 'Google Cloud', 'Azure', 'Vercel'] },
    { title: 'Should big tech be broken up?', options: ['Yes too powerful', 'No let them compete', 'Only some of them'] },
  ],
  General: [
    { title: 'Best season?', options: ['Spring', 'Summer', 'Fall', 'Winter'] },
    { title: 'Morning person or night owl?', options: ['Early bird', 'Night owl', 'Depends on the day'] },
    { title: 'Best social media platform?', options: ['Instagram', 'TikTok', 'Twitter/X', 'YouTube'] },
    { title: 'Cats or dogs?', options: ['Dogs', 'Cats', 'Both', 'Neither'] },
    { title: 'Best fast food?', options: ['Chick-fil-A', 'McDonalds', 'In-N-Out', 'Wendys'] },
    { title: 'Coffee or tea?', options: ['Coffee', 'Tea', 'Both', 'Neither'] },
    { title: 'Best way to spend a weekend?', options: ['Outdoors adventure', 'Netflix and chill', 'Hanging with friends', 'Solo hobbies'] },
    { title: 'Pineapple on pizza?', options: ['Yes its amazing', 'No its a crime', 'Only with ham'] },
    { title: 'Best music genre?', options: ['Hip Hop', 'Pop', 'Rock', 'R&B'] },
    { title: 'Would you rather be famous or rich?', options: ['Famous', 'Rich', 'Both', 'Neither just happy'] },
    { title: 'Ideal vacation?', options: ['Beach resort', 'Mountain cabin', 'City trip', 'Road trip'] },
    { title: 'Is cereal a soup?', options: ['Yes technically', 'Absolutely not', 'I never thought about it'] },
  ],
};

async function seed() {
  console.log('Starting clean seed...\n');

  // 1. Create PollsPlus system account
  const passwordHash = await bcrypt.hash('SystemAccount_NoLogin_2024!', 10);
  const userResult = await pool.query(
    "INSERT INTO users (username, email, password_hash, category) VALUES ('PollsPlus', 'system@pollsplus.com', $1, 'General') RETURNING id",
    [passwordHash]
  );
  const systemId = userResult.rows[0].id;
  console.log('Created PollsPlus system account (id: ' + systemId + ')');

  // 2. Create 6 communities — no members, founded by PollsPlus
  for (const c of COMMUNITIES) {
    await pool.query(
      'INSERT INTO communities (name, category, founder_id, is_private) VALUES ($1, $2, $3, false)',
      [c.name, c.category, systemId]
    );
    console.log('  Created: ' + c.name);
  }

  // 3. Create 12 debates per category (72 total) — all by PollsPlus, no community, no votes
  let count = 0;
  for (const [category, debates] of Object.entries(DEBATES)) {
    for (const d of debates) {
      const minutesAgo = Math.floor(Math.random() * 4320);
      const createdAt = new Date(Date.now() - minutesAgo * 60000).toISOString();

      const result = await pool.query(
        'INSERT INTO debates (user_id, community_id, title, category, created_at) VALUES ($1, NULL, $2, $3, $4) RETURNING id',
        [systemId, d.title, category, createdAt]
      );

      for (let i = 0; i < d.options.length; i++) {
        await pool.query(
          'INSERT INTO debate_options (debate_id, label, position) VALUES ($1, $2, $3)',
          [result.rows[0].id, d.options[i], i]
        );
      }
      count++;
    }
  }

  console.log('\nCreated ' + count + ' debates (0 votes each)');

  // Final summary
  const summary = await pool.query(
    "SELECT c.name, c.category, (SELECT COUNT(*) FROM community_members WHERE community_id = c.id)::int AS members FROM communities c ORDER BY c.id"
  );
  console.log('\nCommunities:', summary.rows);

  const debateCount = await pool.query('SELECT category, COUNT(*)::int AS c FROM debates GROUP BY category ORDER BY category');
  console.log('\nDebates per category:', debateCount.rows);

  const userCount = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  console.log('\nTotal users:', userCount.rows[0].c);

  console.log('\nSeed complete!');
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
