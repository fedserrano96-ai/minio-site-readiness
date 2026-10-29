// Netlify serverless function: keeps the Airtable PAT server-side.
// POST /.netlify/functions/submit
// No recordId: creates one Airtable record. With recordId: updates that record.
import { buildFields, RECORD_ID_RE, type FieldValue } from '../../src/server/airtable-fields';
import type { SubmissionPayload } from '../../src/server/airtable-fields';

const BASE_ID = 'appj87SHEgZafCMC2';
const TABLE = 'Submissions';
const TABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface HandlerEvent { httpMethod: string; body: string | null }
interface HandlerResult { statusCode: number; headers: Record<string, string>; body: string }

const headers: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function reply(statusCode: number, body: unknown): HandlerResult {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function airtableMessage(json: unknown): string {
  const error = (json as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' ? message : 'Airtable error';
}

export async function handler(event: HandlerEvent): Promise<HandlerResult> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed' });
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    console.error('AIRTABLE_PAT env var is not set');
    return reply(500, { error: 'Server misconfiguration' });
  }

  let data: unknown;
  try {
    data = JSON.parse(event.body ?? '');
  } catch {
    return reply(400, { error: 'Invalid JSON body' });
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return reply(400, { error: 'Request body must be a JSON object' });
  }
  const payload = data as SubmissionPayload;

  const email = payload.contact?.email;
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return reply(400, { error: 'A valid email is required' });
  }
  if (payload.recordId !== undefined
      && (typeof payload.recordId !== 'string' || !RECORD_ID_RE.test(payload.recordId))) {
    return reply(400, { error: 'Invalid recordId' });
  }

  const isCreate = payload.recordId === undefined;
  let fields: Record<string, FieldValue>;
  try {
    fields = buildFields({ ...payload, contact: { ...payload.contact, email: email.trim() } }, isCreate);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Invalid submission payload:', message);
    return reply(400, { error: `Invalid submission: ${message}` });
  }

  try {
    const res = await fetch(isCreate ? TABLE_URL : `${TABLE_URL}/${payload.recordId}`, {
      method: isCreate ? 'POST' : 'PATCH',
      headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true }),
    });
    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      // An HTML error page (a 502 from a proxy, say) is not JSON and has no Airtable message in it.
      if (!(err instanceof SyntaxError)) throw err;
      console.error(`Airtable returned a body that is not JSON (status ${res.status})`);
      return reply(res.ok ? 502 : res.status, { error: `Airtable returned an unexpected response (status ${res.status})` });
    }

    if (!res.ok) {
      console.error('Airtable error:', json);
      return reply(res.status, { error: airtableMessage(json) });
    }
    return reply(200, { id: (json as { id: string }).id });
  } catch (err) {
    console.error('Fetch error:', err);
    return reply(500, { error: err instanceof Error ? err.message : String(err) });
  }
}
