// api/strava.js  — runs on Vercel, keeps client_secret safe
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── Exchange auth code for tokens ──
  if (action === 'token' && req.method === 'POST') {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(400).json(data);
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete,
    });
  }

  // ── Refresh access token ──
  if (action === 'refresh' && req.method === 'POST') {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(400).json(data);
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    });
  }

  // ── Fetch recent activities ──
  if (action === 'activities' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });

    const perPage = req.query.per_page || 30;
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
      { headers: { Authorization: authHeader } }
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    // Map to LoadPulse fields
    const mapped = data.map(a => ({
      date: a.start_date_local.split('T')[0],
      type: mapStravaType(a.type),
      dist: parseFloat((a.distance / 1000).toFixed(2)),
      time: Math.round(a.moving_time / 60),
      hr: a.average_heartrate || 0,
      elev: Math.round(a.total_elevation_gain || 0),
      name: a.name,
    }));
    return res.status(200).json(mapped);
  }

  return res.status(400).json({ error: 'Unknown action' });
}

function mapStravaType(type) {
  if (['Run','TrailRun'].includes(type)) return 'Training';
  if (type === 'Workout') return 'Gym';
  return 'Training';
}
