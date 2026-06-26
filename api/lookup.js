export default async function handler(req, res) {
  // Only allow GET requests (or POST if you change the frontend)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { number } = req.query;

  if (!number) {
    return res.status(400).json({ error: 'Target number is required' });
  }

  try {
    // Read the secret API endpoint from Vercel Environment Variables
    // The user will set API_BASE_URL to 'https://num.pvtkeditz.workers.dev/'
    const baseUrl = process.env.API_BASE_URL;

    if (!baseUrl) {
      console.error('API_BASE_URL environment variable is missing.');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Construct the secure URL
    const targetUrl = `${baseUrl}?number=${encodeURIComponent(number)}`;

    // Fetch from the upstream worker
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    const data = await response.json();

    // Send the response back to the frontend
    res.status(200).json(data);

  } catch (error) {
    console.error('Lookup Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Upstream connection failed',
      details: error.message 
    });
  }
}
