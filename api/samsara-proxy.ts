export default async function handler(req: any, res: any) {
  const token = process.env.VITE_SAMSARA_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'No API token configured' });
    return;
  }

  const url = new URL('https://api.samsara.com/form-submissions/stream');

  // Forward all query params to Samsara generically
  const query = req.query as Record<string, string | string[]>;
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Proxy error' });
  }
}
