// api/whoop.js  — runs on Vercel, keeps client_secret safe
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── Exchange auth code for tokens ──
  if (action === 'token' && req.method === 'POST') {
    const { code, redirect_uri } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
      redirect_uri: redirect_uri || process.env.WHOOP_REDIRECT_URI,
    });

    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) return res.status(400).json(data);
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });
  }

  // ── Refresh access token ──
  if (action === 'refresh' && req.method === 'POST') {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    });

    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) return res.status(400).json(data);
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });
  }

  // ── Fetch recovery data ──
  if (action === 'recovery' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });

    const response = await fetch(
      'https://api.prod.whoop.com/developer/v1/recovery?limit=30',
      { headers: { Authorization: authHeader } }
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data.records || []);
  }

  // ── Fetch sleep data ──
  if (action === 'sleep' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });

    const response = await fetch(
      'https://api.prod.whoop.com/developer/v1/sleep?limit=30',
      { headers: { Authorization: authHeader } }
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    // Map to LoadPulse fields
    const mapped = (data.records || []).map(s => ({
      date: s.start.split('T')[0],
      sleep: parseFloat((s.score?.stage_summary?.total_in_bed_time_milli / 3600000).toFixed(1)) || 0,
      slow: parseFloat((
        ((s.score?.stage_summary?.slow_wave_sleep_duration_milli || 0) +
         (s.score?.stage_summary?.rem_sleep_time_milli || 0)) / 3600000
      ).toFixed(1)),
      rhr: s.score?.respiratory_rate ? Math.round(s.score.respiratory_rate) : 0,
    }));
    return res.status(200).json(mapped);
  }

  // ── Fetch combined: recovery + sleep merged by date ──
  if (action === 'combined' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });

    const [recRes, sleepRes] = await Promise.all([
      fetch('https://api.prod.whoop.com/developer/v1/recovery?limit=30', { headers: { Authorization: authHeader } }),
      fetch('https://api.prod.whoop.com/developer/v1/sleep?limit=30', { headers: { Authorization: authHeader } }),
    ]);

    const [recData, sleepData] = await Promise.all([recRes.json(), sleepRes.json()]);

    const byDate = {};

    (recData.records || []).forEach(r => {
      const date = r.created_at?.split('T')[0];
      if (!date) return;
      byDate[date] = byDate[date] || { date };
      byDate[date].rec = r.score?.recovery_score || 0;
      byDate[date].rhr = r.score?.resting_heart_rate || 0;
      byDate[date].hrv = r.score?.hrv_rmssd_milli || 0;
    });

    (sleepData.records || []).forEach(s => {
      const date = s.start?.split('T')[0];
      if (!date) return;
      byDate[date] = byDate[date] || { date };
      byDate[date].sleep = parseFloat((s.score?.stage_summary?.total_in_bed_time_milli / 3600000).toFixed(1)) || 0;
      byDate[date].slow = parseFloat((
        ((s.score?.stage_summary?.slow_wave_sleep_duration_milli || 0) +
         (s.score?.stage_summary?.rem_sleep_time_milli || 0)) / 3600000
      ).toFixed(1));
    });

    return res.status(200).json(Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)));
  }

  return res.status(400).json({ error: 'Unknown action' });
}
