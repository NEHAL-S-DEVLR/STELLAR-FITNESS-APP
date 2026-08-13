// Vercel entry point. Vercel serves any file under /api as a serverless
// function; this file just re-exports the Express app so Vercel can hand off
// requests to it. All routing is handled inside server.js.
module.exports = require('../server.js');
