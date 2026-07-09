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
const data = require('../../data/jurisdictions.json');

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Mini·O Permitting <onboarding@resend.dev>';

const PERMIT_LABELS = {
  building_permit: 'Building permit',
  electrical_permit: 'Electrical permit',
  plumbing_permit: 'Plumbing permit',
  zoning_review: 'Zoning review',
};

const POSTURE_LABELS = {
  likely_exempt: 'Likely exempt',
  likely_required: 'Likely required',
  depends: 'Depends',
  not_applicable: 'Not applicable',
  footings_likely_required: 'Footings likely required',
  standard_ok: 'Standard slab/pier OK',
};

const CATEGORY_LABELS = {
  insulation: 'Insulation',
  foundation: 'Foundation',
  snow_load: 'Snow load',
  wind: 'Wind',
  seismic: 'Seismic',
  energy: 'Energy',
  other: 'Other',
};

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
    html: renderEmail(out, quick, address),
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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEmail(out, quick, address) {
  const td = 'padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;';
  let h = '';

  h += '<div style="font-family:Georgia,serif;font-size:22px;color:#535266;margin-bottom:4px;">Mini&middot;O</div>';
  h += '<h1 style="font-family:Georgia,serif;font-size:24px;color:#535266;margin:12px 0 4px;">' + esc(quick.headline) + '</h1>';
  h += '<p style="color:#535266;font-size:15px;margin:0 0 16px;">' +
    esc(out.jurisdiction) + (address ? ' &middot; ' + esc(address) : '') +
    '<br>Configuration: ' + esc(out.config_summary) + '</p>';

  h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Permits at a glance</h2>';
  h += '<table style="border-collapse:collapse;width:100%;max-width:560px;">';
  Object.keys(out.permits).forEach((p) => {
    h += '<tr><td style="' + td + '">' + esc(PERMIT_LABELS[p] || p) + '</td><td style="' + td + 'font-weight:bold;">' +
      esc(POSTURE_LABELS[out.permits[p]] || out.permits[p]) + '</td></tr>';
  });
  h += '<tr><td style="' + td + '">Energy compliance' + (out.energy_compliance.code ? ' (' + esc(out.energy_compliance.code) + ')' : '') +
    '</td><td style="' + td + 'font-weight:bold;">' + esc(POSTURE_LABELS[out.energy_compliance.posture] || out.energy_compliance.posture) + '</td></tr>';
  h += '<tr><td style="' + td + '">Foundation</td><td style="' + td + 'font-weight:bold;">' +
    esc(POSTURE_LABELS[out.foundation_requirement.posture] || out.foundation_requirement.posture) + '</td></tr>';
  h += '</table>';

  h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Notes</h2><ul style="font-size:14px;color:#333;">';
  h += '<li>' + esc(out.energy_compliance.note) + '</li>';
  h += '<li>' + esc(out.foundation_requirement.note) + '</li>';
  out.notes.forEach((n) => { h += '<li>' + esc(n) + '</li>'; });
  if (out.config_lock_note) h += '<li>' + esc(out.config_lock_note) + '</li>';
  h += '</ul>';

  const reqs = out.construction_requirements;
  h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Building requirements</h2>';
  if (reqs.status === 'listed') {
    if (reqs.verified.length) {
      h += '<ul style="font-size:14px;color:#333;">';
      reqs.verified.forEach((r) => {
        h += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' + esc(r.requirement) +
          ' <span style="color:#777;">(' + esc(r.citation.code_section) + ', confidence: ' + esc(r.confidence) + ')</span></li>';
      });
      h += '</ul>';
    }
    if (reqs.unverified.length) {
      h += '<p style="font-size:14px;font-weight:bold;color:#333;">Unverified — confirm with the office:</p><ul style="font-size:14px;color:#555;">';
      reqs.unverified.forEach((r) => {
        h += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' + esc(r.requirement) + '</li>';
      });
      h += '</ul>';
    }
  } else {
    h += '<p style="font-size:14px;color:#333;">' + esc(reqs.note) + '</p>';
  }

  if (out.citations.length) {
    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Citations</h2>';
    out.citations.forEach((c) => {
      h += '<p style="font-size:13px;color:#333;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px 10px;">' +
        '<strong>' + esc(c.code_section) + '</strong> — ' + esc(c.title) + ' (confidence: ' + esc(c.confidence) + ')<br>' +
        (c.snippet ? '&ldquo;' + esc(c.snippet) + '&rdquo;<br>' : '') +
        '<a href="' + esc(c.url) + '" style="color:#535266;">' + esc(c.url) + '</a></p>';
    });
  }

  h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Next step</h2>';
  h += '<p style="font-size:14px;color:#333;">' + esc(out.next_step.contact) + '</p><ul style="font-size:14px;color:#333;">';
  out.next_step.questions.forEach((q) => { h += '<li>' + esc(q) + '</li>'; });
  h += '</ul>';

  if (out.zoning_note) {
    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Zoning</h2><p style="font-size:14px;color:#333;">' + esc(out.zoning_note) + '</p>';
  }
  h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">HOA</h2><p style="font-size:14px;color:#333;">' + esc(out.hoa_note) + '</p>';

  h += '<div style="background:#E3CDBF;border-radius:8px;padding:14px 16px;font-size:14px;color:#3d3c4b;margin:18px 0;">' +
    '<strong>Don&rsquo;t want to deal with any of this?</strong> Mini&middot;O&rsquo;s permitting package handles the whole thing — ' +
    'research, drawings, submitting, and any back-and-forth with your city. Just reply to this email.</div>';

  h += '<p style="font-size:12px;color:#9398A5;border-top:1px solid #eee;padding-top:10px;">' + esc(out.disclaimer) + '</p>';

  return h;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
