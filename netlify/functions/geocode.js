// Netlify serverless function shim — the permitting engine's geocode proxy.
// Source of truth lives in permitting-engine/netlify/functions/geocode.js;
// this re-export puts it in the parent site's functions directory so it
// deploys with the main Readiness Assessment site.
// GET /.netlify/functions/geocode?address=<oneline address>

module.exports = require('../../permitting-engine/netlify/functions/geocode.js');
