// Vercel's own /api convention — any file here is auto-deployed as a
// serverless function, no custom vercel.json build step needed for it.
// This re-exports the real Express app (backend/server.js); the rewrites
// in vercel.json point every backend-owned path (API, admin/login pages,
// uploads) at this one function, while Next.js's own static export keeps
// handling the marketing site natively.
module.exports = require('../backend/server.js');
