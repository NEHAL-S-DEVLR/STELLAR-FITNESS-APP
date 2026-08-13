// Vercel's zero-config Node runtime searches the project root for exactly
// this filename. The real Express app lives in backend/server.js; this file
// just re-exports it so Vercel has an entrypoint to find at the root.
module.exports = require('./backend/server.js');
