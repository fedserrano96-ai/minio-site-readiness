/*
 * GET /.netlify/functions/geocode?address=<oneline address>
 *
 * Proxies the free US Census geocoder (which sends no CORS headers, so the
 * browser can't call it directly). No API key. Returns:
 *   200 { result: <parsed> }   — parsed is null when Census found no match
 *   400 { error }              — missing address param
 *   502 { error }              — Census unreachable, non-200, or >8s
 */

'use strict';

const resolver = require('../../resolver.js');

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';
const TIMEOUT_MS = 8000;

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const address = (params.address || '').trim();
  if (!address) {
    return json(400, { error: 'Missing address parameter.' });
  }

  const url =
    CENSUS_URL +
    '?address=' + encodeURIComponent(address) +
    '&benchmark=Public_AR_Current&vintage=Current_Current' +
    '&layers=' + encodeURIComponent('Counties,Incorporated Places') +
    '&format=json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return json(502, { error: 'Census geocoder returned ' + res.status + '.' });
    }
    let raw;
    try {
      raw = await res.json();
    } catch (_) {
      return json(502, { error: 'Census geocoder returned an unparseable response.' });
    }
    return json(200, { result: resolver.parseCensusResponse(raw) });
  } catch (err) {
    return json(502, { error: 'Census geocoder unreachable or timed out.' });
  } finally {
    clearTimeout(timer);
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
