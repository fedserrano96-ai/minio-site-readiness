import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../../netlify/functions/submit';
import { buildFields } from '../../src/server/airtable-fields';
import type { SubmissionPayload } from '../../src/server/airtable-fields';
import { priceRecommendation } from '../../src/assessment/core/pricing';
import { lookupLocation } from '../../src/assessment/core/location';
import type { Recommendation } from '../../src/assessment/core/types';
import { buildReadable } from '../../src/assessment/ui/print';
import { questionCopy } from '../../src/assessment/ui/questions-copy';

const TABLE_URL = 'https://api.airtable.com/v0/appj87SHEgZafCMC2/Submissions';
const REC_ID = 'recABCDEFGHIJKLMN';

function payload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  const location = lookupLocation('98101');
  if (!location) throw new Error('test setup: no location for 98101');
  const recommendation: Recommendation = {
    model: 'sixteen', method: 'shedMule', craneFrom: null, base: 'gravel',
    methodReason: null, baseReason: null, bathroom: 'none', door: 'standard',
    ramps: false, takeDown: null, hardSurface: false, toCheck: [], notes: [],
  };
  const answers = { zip: '98101', panelDistance: '25to50' as const };
  return {
    contact: { email: 'pat@example.com', firstName: 'Pat', phone: '555-0100' },
    ctaHistory: ['design'],
    snapshot: {
      model: 'sixteen', rotation: 90, yardW: 40, yardD: 30, podX: 20, podY: 15,
      podUse: 'guest', objects: [],
    },
    answers,
    recommendation,
    cost: priceRecommendation(recommendation, location, answers),
    lead: { minWeeks: 8, maxWeeks: 10 },
    location,
    readable: {
      answers: 'ZIP: 98101', toCheck: 'Panel distance', costNotes: 'Estimate only',
      method: 'Shed mule', base: 'Gravel pad', leadTime: '8 to 10 weeks',
    },
    ...overrides,
  };
}

function okResponse(id = REC_ID) {
  return { ok: true, status: 200, json: async () => ({ id }) };
}

describe('submit handler', () => {
  const realFetch = globalThis.fetch;
  const realPat = process.env.AIRTABLE_PAT;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.AIRTABLE_PAT = 'test-pat';
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realPat === undefined) delete process.env.AIRTABLE_PAT;
    else process.env.AIRTABLE_PAT = realPat;
  });

  const post = (body: unknown) => handler({ httpMethod: 'POST', body: JSON.stringify(body) });

  it('creates a record', async () => {
    fetchMock.mockResolvedValue(okResponse());
    const res = await post(payload());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: REC_ID });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(TABLE_URL);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-pat');
    const sent = JSON.parse(init.body);
    expect(sent.typecast).toBe(true);
    expect(sent.fields['Submission Date']).toBeTruthy();
  });

  it('updates an existing record', async () => {
    fetchMock.mockResolvedValue(okResponse());
    const res = await post(payload({ recordId: REC_ID, ctaHistory: ['design', 'talk'] }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: REC_ID });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${TABLE_URL}/${REC_ID}`);
    expect(init.method).toBe('PATCH');
    const sent = JSON.parse(init.body);
    expect(sent.fields).not.toHaveProperty('Submission Date');
    expect(sent.fields['Buttons Clicked']).toBe('design, talk');
  });

  it('rejects a bad record id', async () => {
    const res = await post(payload({ recordId: 'rec123' }));
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing email', async () => {
    const p = payload();
    const res = await post({ ...p, contact: { ...p.contact, email: '' } });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const p = payload();
    const res = await post({ ...p, contact: { ...p.contact, email: 'not-an-email' } });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON', async () => {
    const res = await handler({ httpMethod: 'POST', body: '{nope' });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty body', async () => {
    const res = await handler({ httpMethod: 'POST', body: null });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a payload missing its plan data', async () => {
    const res = await post({ contact: { email: 'pat@example.com', firstName: '', phone: '' } });
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers OPTIONS with 204 and other methods with 405', async () => {
    expect((await handler({ httpMethod: 'OPTIONS', body: null })).statusCode).toBe(204);
    expect((await handler({ httpMethod: 'GET', body: null })).statusCode).toBe(405);
  });

  it('returns 500 when the token is missing', async () => {
    delete process.env.AIRTABLE_PAT;
    const res = await post(payload());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe('Server misconfiguration');
  });

  it("returns Airtable's error message and status", async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 422,
      json: async () => ({ error: { type: 'UNKNOWN_FIELD_NAME', message: 'Unknown field name: "ZIP"' } }),
    });
    const res = await post(payload());
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toContain('Unknown field name');
  });

  it('returns a plain message when Airtable replies with something that is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 502,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
    });
    const res = await post(payload());
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toBe('Airtable returned an unexpected response (status 502)');
  });
});

describe('buildFields', () => {
  it('maps fields', () => {
    const f = buildFields(payload(), true);
    expect(f['Email']).toBe('pat@example.com');
    expect(f['First Name']).toBe('Pat');
    expect(f['Phone']).toBe('555-0100');
    expect(f['Buttons Clicked']).toBe('design');
    expect(f['ZIP']).toBe('98101');
    expect(f['State']).toBe('Washington');
    expect(f['Price Region']).toBe('WA');
    expect(f['In Coverage']).toBe(true);
    expect(f['Pod Model']).toBe('The Sixteen');
    expect(f['Pod Use']).toBe('Guest Suite');
    expect(f['Yard Dimensions']).toBe('40 x 30 ft');
    expect(f['Pod Orientation']).toBe('90°');
    expect(f['Recommended Method']).toBe('Shed mule');
    expect(f['Base']).toBe('Gravel pad');
    expect(f['Cost Low']).toBe(7600);
    expect(f['Cost High']).toBe(10181);
    expect(f['Cost Notes']).toBe('Estimate only');
    expect(f['Shipping Estimate']).toBe(1100);
    expect(f['Lead Time']).toBe('8 to 10 weeks');
    expect(f['To Check']).toBe('Panel distance');
    expect(f['Answers']).toBe('ZIP: 98101');
    expect(JSON.parse(String(f['Planner Snapshot'])).yardW).toBe(40);
    expect(f['Assessment Version']).toBe('v3');
    expect(f['Door']).toBe('Standard');
    expect(f['Submission Date']).toBeTruthy();
    expect(f['Last Updated']).toBeTruthy();
  });

  it('writes the questions a client answered into Answers', () => {
    const p = payload();
    const answers = { zip: '98101', truckAccess: 'no' as const, turn: 'tight' as const };
    const readable = buildReadable({
      rec: p.recommendation, cost: p.cost, lead: p.lead, location: p.location, answers,
    });
    const f = buildFields({ ...p, answers, readable }, true);
    expect(String(f['Answers'])).toContain(questionCopy('turn', 'sixteen').title);
  });

  it('leaves out Submission Date on update', () => {
    expect(buildFields(payload(), false)).not.toHaveProperty('Submission Date');
  });

  it('talk mode omits the cost numbers', () => {
    const f = buildFields(payload({ cost: { mode: 'talk' } }), true);
    expect(f).not.toHaveProperty('Cost Low');
    expect(f).not.toHaveProperty('Cost High');
    expect(f).not.toHaveProperty('Shipping Estimate');
    expect(f['Cost Notes']).toBe("Let's talk");
  });

  it('talk mode on update clears the old cost numbers', () => {
    const f = buildFields(payload({ cost: { mode: 'talk' } }), false);
    expect(f['Cost Low']).toBeNull();
    expect(f['Cost High']).toBeNull();
    expect(f['Shipping Estimate']).toBeNull();
    expect(f['Cost Notes']).toBe("Let's talk");
  });

  it('no shipping line: omitted on create, cleared on update', () => {
    const p = payload();
    if (p.cost.mode !== 'range') throw new Error('test setup: expected a range');
    const cost = { ...p.cost, lines: p.cost.lines.filter((l) => l.id !== 'shipping') };
    expect(buildFields({ ...p, cost }, true)).not.toHaveProperty('Shipping Estimate');
    const update = buildFields({ ...p, cost }, false);
    expect(update['Shipping Estimate']).toBeNull();
    expect(update['Cost Low']).toBe(cost.low);
  });

  it('takes the ZIP from the answers only', () => {
    const f = buildFields(payload({ answers: {} }), true);
    expect(f['ZIP']).toBe('');
  });

  it('handles a missing location', () => {
    const f = buildFields(payload({ location: null, answers: {} }), true);
    expect(f['State']).toBe('');
    expect(f['Price Region']).toBe('');
    expect(f['In Coverage']).toBe(false);
    expect(f['ZIP']).toBe('');
  });

  it('labels the other pod uses and 0 degree orientation', () => {
    const p = payload();
    const f = buildFields({ ...p, snapshot: { ...p.snapshot, podUse: 'office', rotation: 0 } }, true);
    expect(f['Pod Use']).toBe('Office');
    expect(f['Pod Orientation']).toBe('0°');
  });
});
