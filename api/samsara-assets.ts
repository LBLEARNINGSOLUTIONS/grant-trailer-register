export default async function handler(_req: any, res: any) {
  const token = process.env.VITE_SAMSARA_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'No API token configured' });
    return;
  }

  // Samsara splits assets across multiple endpoints — fetch all and merge
  const endpoints = [
    'https://api.samsara.com/fleet/trailers',
    'https://api.samsara.com/fleet/equipment',
    'https://api.samsara.com/fleet/vehicles',
  ];

  const allAssets: { id: string; name: string; source: string }[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) continue;
      const body = await response.json();
      const items = body.data ?? body;
      const source = endpoint.split('/').pop() ?? 'unknown';
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.id && item.name) {
            allAssets.push({ id: String(item.id), name: item.name, source });
          }
        }
      }
    } catch {
      // Skip failed endpoints
    }
  }

  res.status(200).json({ data: allAssets, count: allAssets.length });
}
