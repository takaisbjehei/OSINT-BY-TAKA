export default function handler(req, res) {
  // Return the Supabase credentials from Vercel Environment Variables
  res.status(200).json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY
  });
}
