export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  try {
    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_ANON_KEY;

    if (!supaUrl || !supaKey) {
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
      return res.status(401).json({ error: 'Invalid session' });
    }
    const user = await userRes.json();

    // 2. Fetch both mobile and aadhaar counts via RPC
    const getCount = async (type) => {
      const res = await fetch(`${supaUrl}/rest/v1/rpc/check_rate_limit`, {
        method: 'POST',
        headers: {
          'apikey': supaKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_user_id: user.id, p_search_type: type })
      });
      return await res.json();
    };

    const mobileCount = await getCount('mobile');
    const aadhaarCount = await getCount('aadhaar');

    return res.status(200).json({
      mobile: typeof mobileCount === 'number' ? mobileCount : 0,
      aadhaar: typeof aadhaarCount === 'number' ? aadhaarCount : 0
    });

  } catch (err) {
    console.error('Stats Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
