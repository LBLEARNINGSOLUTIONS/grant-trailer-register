export default async function handler(_req: any, res: any) {
  const token = process.env.VITE_SAMSARA_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'No API token configured' });
    return;
  }

  try {
    const response = await fetch('https://api.samsara.com/fleet/drivers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Proxy error' });
  }
}
