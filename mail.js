export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, login, domain, id } = req.query;

    if (!action) return res.status(400).json({ error: 'action required' });

    let apiUrl = `https://www.1secmail.com/api/v1/?action=${action}`;
    if (login) apiUrl += `&login=${encodeURIComponent(login)}`;
    if (domain) apiUrl += `&domain=${encodeURIComponent(domain)}`;
    if (id) apiUrl += `&id=${encodeURIComponent(id)}`;

    const response = await fetch(apiUrl);
    if (!response.ok) return res.status(response.status).json({ error: 'upstream' });

    const data = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}