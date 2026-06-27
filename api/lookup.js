export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, type } = req.query;
  const authHeader = req.headers.authorization;

  if (!query || !authHeader) {
    return res.status(400).json({ error: 'Query and Authorization required' });
  }

  try {
    const baseUrl = process.env.API_BASE_URL;
    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_ANON_KEY;

    if (!baseUrl || !supaUrl || !supaKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 1. Verify User Token
    const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: {
        'apikey': supaKey,
        'Authorization': authHeader
      }
    });
    
    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    const user = await userRes.json();

    // 2. Check Rate Limit via RPC (Returns JSON: { usage, max, hours })
    const limitRes = await fetch(`${supaUrl}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'apikey': supaKey,
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_user_id: user.id, p_search_type: type })
    });
    
    const limitData = await limitRes.json();
    if (limitData.usage >= limitData.max) {
      return res.status(429).json({ error: 'Rate limit exceeded', limitReached: true, limitMax: limitData.max });
    }

    // 3. Construct the secure URL
    // The upstream API always expects ?number= regardless of the search type
    const targetUrl = `${baseUrl}?number=${encodeURIComponent(query)}`;

    // 4. Fetch from the upstream worker
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    const data = await response.json();

    // 5. Log the search in Supabase
    await fetch(`${supaUrl}/rest/v1/search_logs`, {
      method: 'POST',
      headers: {
        'apikey': supaKey,
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_email: user.email,
        user_id: user.id,
        search_type: type,
        query_target: query,
        result_summary: { count: data.data?.length || 0 }
      })
    });

    // Send the response back to the frontend with the new count and dynamic max
    res.status(200).json({ 
      ...data, 
      current_usage: limitData.usage + 1, 
      limitMax: limitData.max,
      limitReset: limitData.reset_at
    });

  } catch (error) {
    console.error('Lookup Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Upstream connection failed',
      details: error.message 
    });
  }
}
