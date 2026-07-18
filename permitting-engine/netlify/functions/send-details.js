/*
 * POST /.netlify/functions/send-details
 * Body: { email, address?, jurisdiction_id, pod_config }
 *
 * Re-runs the engine server-side (never trusts a client-rendered result) and
 * emails the full technical breakdown — permits, building requirements,
 * citations, next steps — via the Resend HTTP API.
 *
 * Requires env vars:
 *   RESEND_API_KEY      — Resend API key. Missing → 503 with a clear error.
 *   SEND_DETAILS_FROM   — optional From header, defaults to Resend's onboarding sender.
 *
 * Returns: 200 { ok: true } | 400 { error } | 503 { error } | 502 { error }
 */

'use strict';

const engine = require('../../engine.js');
const summary = require('../../summary.js');
const report = require('../../report.js');
const data = require('../../data/jurisdictions.json');

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Mini·O Permitting <onboarding@resend.dev>';

const PLUMBING_VALUES = ['none', 'half_bath', 'kitchenette', 'full_bath'];
const MODEL_VALUES = ['twelve', 'sixteen', 'station', 'custom'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json(400, { error: 'A valid email address is required.' });
  }

  const podConfig = sanitizePodConfig(body.pod_config);
  if (!podConfig) {
    return json(400, { error: 'Invalid pod configuration.' });
  }

  const address =
    typeof body.address === 'string' && body.address.trim()
      ? body.address.trim().slice(0, 200)
      : null;

  const jurisdiction =
    data.jurisdictions.find((j) => j.id === body.jurisdiction_id) || null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return json(503, {
      error: 'Email sending is not configured yet (RESEND_API_KEY is missing).',
    });
  }

  const out = engine.evaluate(podConfig, jurisdiction, {
    productDefault: data.product_default,
  });
  const quick = summary.summarize(out);

  const payload = {
    from: process.env.SEND_DETAILS_FROM || DEFAULT_FROM,
    to: [email],
    subject: 'Your Mini·O permitting breakdown — ' + (address || out.jurisdiction),
    html: report.render(out, quick, address),
  };

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Resend error', res.status, detail);
      return json(502, { error: 'The email service rejected the send — try again shortly.' });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('Resend unreachable', err);
    return json(502, { error: 'The email service is unreachable — try again shortly.' });
  }
};

function sanitizePodConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const model = MODEL_VALUES.includes(raw.model) ? raw.model : null;
  const plumbing = PLUMBING_VALUES.includes(raw.plumbing) ? raw.plumbing : null;
  if (!model || !plumbing) return null;
  let footprint = Number(raw.footprint_sqft);
  if (!Number.isFinite(footprint) || footprint < 1 || footprint > 5000) {
    footprint = engine.MODEL_FOOTPRINTS[model];
    if (!footprint) return null;
  }
  return {
    model: model,
    footprint_sqft: Math.round(footprint),
    plumbing: plumbing,
    sleeping_intended: Boolean(raw.sleeping_intended),
    on_trailer: Boolean(raw.on_trailer),
    electrical: 'standard',
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
