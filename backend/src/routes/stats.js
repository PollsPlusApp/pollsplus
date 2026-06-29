const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Campaign window (overridable via env). Default: July 2026.
const CAMPAIGN_START = process.env.CAMPAIGN_START || '2026-07-01';
const CAMPAIGN_END = process.env.CAMPAIGN_END || '2026-08-01';

// Tiny in-memory cache so a public, auto-refreshing page can't hammer the DB.
let cache = { at: 0, data: null };
const CACHE_MS = 15000;

async function computeStats() {
  const totals = (await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users)                         AS total_users,
       (SELECT COUNT(DISTINCT user_id) FROM votes)          AS total_voters,
       (SELECT COUNT(*) FROM votes)                         AS total_votes,
       (SELECT COUNT(*) FROM users
          WHERE created_at >= $1 AND created_at < $2)       AS campaign_signups,
       (SELECT COUNT(*) FROM users u
          WHERE u.created_at >= $1 AND u.created_at < $2
            AND EXISTS (SELECT 1 FROM votes v WHERE v.user_id = u.id)) AS campaign_qualified`,
    [CAMPAIGN_START, CAMPAIGN_END]
  )).rows[0];

  // Daily "qualified" (signed up + voted) within the window, up to today.
  const daily = (await pool.query(
    `WITH days AS (
       SELECT generate_series(
         $1::date,
         LEAST($2::date - INTERVAL '1 day', CURRENT_DATE),
         INTERVAL '1 day'
       )::date AS d
     )
     SELECT days.d AS day,
       (SELECT COUNT(*) FROM users u
          WHERE u.created_at::date = days.d
            AND EXISTS (SELECT 1 FROM votes v WHERE v.user_id = u.id)) AS qualified
     FROM days ORDER BY days.d`,
    [CAMPAIGN_START, CAMPAIGN_END]
  )).rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), qualified: Number(r.qualified) }));

  return {
    campaign: {
      start: CAMPAIGN_START,
      end: CAMPAIGN_END,
      qualified_users: Number(totals.campaign_qualified), // signed up AND voted >= once (the payout metric)
      signups: Number(totals.campaign_signups),
    },
    all_time: {
      total_users: Number(totals.total_users),
      total_voters: Number(totals.total_voters),
      total_votes: Number(totals.total_votes),
    },
    daily,
    updated_at: new Date().toISOString(),
  };
}

// Public JSON — the raw, shareable numbers.
router.get('/api/stats', async (req, res) => {
  try {
    if (cache.data && Date.now() - cache.at < CACHE_MS) {
      return res.json({ ...cache.data, cached: true });
    }
    const data = await computeStats();
    cache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// Public live dashboard page.
router.get('/stats', (req, res) => {
  res.type('html').send(STATS_PAGE);
});

const STATS_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PollsPlus — Live Campaign Stats</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1b2550, #0b0f1f 60%); color: #eef1ff;
    display: flex; align-items: center; justify-content: center; padding: 28px;
  }
  .wrap { width: 100%; max-width: 760px; }
  .brand { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 6px; }
  .brand .dot { width: 11px; height: 11px; border-radius: 50%; background: linear-gradient(135deg,#5b8cff,#a35bff); box-shadow: 0 0 16px #6a7bff; }
  .brand h1 { font-size: 16px; font-weight: 600; letter-spacing: .3px; margin: 0; color: #c8d0ff; }
  .hero {
    margin: 18px 0; padding: 30px 24px; border-radius: 22px; text-align: center;
    background: linear-gradient(180deg, rgba(91,140,255,.16), rgba(163,91,255,.08));
    border: 1px solid rgba(120,140,255,.25);
  }
  .hero .label { font-size: 13px; text-transform: uppercase; letter-spacing: 1.4px; color: #97a3d6; }
  .hero .big { font-size: 72px; font-weight: 800; line-height: 1; margin: 10px 0 6px; letter-spacing: -1px;
    background: linear-gradient(135deg,#cdd8ff,#fff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero .sub { font-size: 14px; color: #9aa4d4; }
  .grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-top: 14px; }
  .card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 16px; text-align: center; }
  .card .n { font-size: 28px; font-weight: 700; }
  .card .t { font-size: 12px; color: #8b95c4; margin-top: 4px; }
  .chart { margin-top: 16px; padding: 16px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 16px; }
  .chart h3 { margin: 0 0 12px; font-size: 13px; color: #9aa4d4; font-weight: 600; }
  .bars { display: flex; align-items: flex-end; gap: 4px; height: 90px; }
  .bar { flex: 1; min-width: 3px; background: linear-gradient(180deg,#6a8bff,#a35bff); border-radius: 4px 4px 0 0; transition: height .4s; }
  .foot { margin-top: 16px; text-align: center; font-size: 12px; color: #6f78a6; }
  @media (max-width: 520px){ .hero .big{ font-size: 56px } .grid{ grid-template-columns: 1fr 1fr } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><span class="dot"></span><h1>PollsPlus · Live Campaign Stats</h1></div>
    <div class="hero">
      <div class="label">New users who signed up &amp; voted</div>
      <div class="big" id="qualified">—</div>
      <div class="sub" id="window">campaign window</div>
    </div>
    <div class="grid">
      <div class="card"><div class="n" id="signups">—</div><div class="t">Signups (campaign)</div></div>
      <div class="card"><div class="n" id="voters">—</div><div class="t">Total voters (all time)</div></div>
      <div class="card"><div class="n" id="votes">—</div><div class="t">Total votes (all time)</div></div>
    </div>
    <div class="chart">
      <h3>Qualified users per day</h3>
      <div class="bars" id="bars"></div>
    </div>
    <div class="foot" id="foot">loading…</div>
  </div>
<script>
  function fmt(n){ return (n==null?'—':Number(n).toLocaleString()); }
  async function load(){
    try{
      const r = await fetch('/api/stats', { cache: 'no-store' });
      const d = await r.json();
      document.getElementById('qualified').textContent = fmt(d.campaign.qualified_users);
      document.getElementById('signups').textContent = fmt(d.campaign.signups);
      document.getElementById('voters').textContent = fmt(d.all_time.total_voters);
      document.getElementById('votes').textContent = fmt(d.all_time.total_votes);
      document.getElementById('window').textContent = d.campaign.start + '  →  ' + d.campaign.end;
      const max = Math.max(1, ...d.daily.map(x=>x.qualified));
      document.getElementById('bars').innerHTML = d.daily.map(x =>
        '<div class="bar" title="'+x.day+': '+x.qualified+'" style="height:'+Math.round((x.qualified/max)*100)+'%"></div>'
      ).join('') || '<div style="color:#6f78a6;font-size:12px">Campaign hasn\\'t started yet</div>';
      const t = new Date(d.updated_at);
      document.getElementById('foot').textContent = 'Live from PollsPlus · updated ' + t.toLocaleString() + ' · refreshes automatically';
    }catch(e){ document.getElementById('foot').textContent = 'Could not load stats — retrying…'; }
  }
  load();
  setInterval(load, 30000);
</script>
</body>
</html>`;

module.exports = router;
