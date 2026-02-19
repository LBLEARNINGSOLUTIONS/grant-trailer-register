export default async function handler(req: any, res: any) {
  const token = process.env.VITE_SAMSARA_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'No API token configured' });
    return;
  }

  const url = new URL('https://api.samsara.com/form-submissions/stream');

  const query = req.query as Record<string, string | string[]>;
  if (query.after) url.searchParams.set('after', String(query.after));

  const ids = Array.isArray(query.formTemplateIds)
    ? query.formTemplateIds
    : query.formTemplateIds ? [query.formTemplateIds] : [];
  ids.forEach((id: string) => url.searchParams.append('formTemplateIds', id));

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
