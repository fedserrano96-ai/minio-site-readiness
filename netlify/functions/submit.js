// Netlify serverless function — keeps the Airtable PAT server-side
// POST /.netlify/functions/submit

const BASE_ID   = 'appj87SHEgZafCMC2';
const TABLE     = 'Submissions';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

/* ── Value mappers ──────────────────────────────────────────── */
const MAP = {
  access_width: {
    gt12: 'More than 12 ft', '10to12': '10–12 ft',
    lt10: 'Less than 10 ft', unsure: 'Unknown',
  },
  overhead_clearance: {
    gt13_5: "More than 13'6\"", '12to13_5': "12–13'6\"",
    lt12: 'Less than 12 ft', unsure: 'Unknown',
  },
  yesno: { yes: 'Yes', no: 'No', unsure: 'Unknown' },
  slope:  { flat: 'Flat', slope: 'Slope', unsure: 'Unknown' },
  surface: {
    grass: 'Grass', gravel: 'Gravel', concrete: 'Concrete',
    deck: 'Wood Deck', other: 'Other', unsure: 'Unknown',
  },
  ground_level:    { level: 'Level', slope: 'Slope', unsure: 'Unknown' },
  foundation:      { concrete: 'Concrete', gravel: 'Gravel', not_prepared: 'Not Prepared', unsure: 'Unknown' },
  amperage:        { '200': '200A', '100': '100A', other: 'Other', unsure: 'Unknown' },
  distance: {
    lt25: 'Less than 25 ft', '25to50': '25–50 ft',
    '50to100': '50–100 ft', gt100: 'More than 100 ft', unsure: 'Unknown',
  },
  sewer:    { sewer: 'Sewer', septic: 'Septic', unsure: 'Unknown' },
  internet: { wifi: 'Wi-Fi', ethernet: 'Ethernet', later: 'Later', unsure: 'Unknown' },
  permit: {
    required: 'Required', not_required: 'Not Required',
    not_checked: 'Not Checked', unsure: 'Unknown',
  },
  delivery: {
    shed_mule: 'Shed Mule', shed_mule_adjusted: 'Shed Mule With Adjustments',
    crane: 'Crane Likely', tbd: 'TBD',
  },
  overall: {
    ready: 'Ready', action: 'Needs Attention',
    find_out: 'Mostly Ready', blocker: 'Has Blockers',
  },
  pod_use: {
    office: 'Office', studio: 'Studio',
    guest_suite: 'Guest Suite', other: 'Other',
  },
};

function m(map, val) {
  return MAP[map][val] ?? 'Unknown';
}

/* ── Build Airtable fields object ───────────────────────────── */
function buildFields(data) {
  const { contact, answers = {}, answersText = {}, plannerSnap = {}, report = {} } = data;

  const iDontKnowCount = Object.values(answers).filter(v => v === 'unsure').length;

  // Helpers for optional text fields
  const obstacleText = answers.wiring_obstacles === 'yes'
    ? (answersText.wiring_obstacles || 'Yes (details not provided)')
    : answers.wiring_obstacles === 'clear' ? 'None' : '';

  const removalText = answers.temporary_removals === 'yes'
    ? (answersText.temporary_removals || 'Yes (details not provided)')
    : answers.temporary_removals === 'clear' ? 'None' : '';

  return {
    // ── Contact
    'First Name':       contact.firstName || '',
    'Last Name':        contact.lastName  || '',
    'Email':            contact.email     || '',
    'Phone':            contact.phone     || '',
    'Submission Date':  new Date().toISOString(),

    // ── Pod
    'Pod Model':        plannerSnap.podName    || '',
    'Pod Use':          m('pod_use', plannerSnap.podUse),
    'Yard Dimensions':  plannerSnap.yardW && plannerSnap.yardD
                          ? `${plannerSnap.yardW} x ${plannerSnap.yardD} ft`
                          : '',
    'Pod Orientation':  plannerSnap.rotation === 90 ? '90°' : '0°',

    // ── Access Path
    'Access Width':          m('access_width',        answers.access_width),
    'Overhead Clearance':    m('overhead_clearance',  answers.overhead_clearance),
    'Sharp Turns':           m('yesno',               answers.sharp_turns),
    'Slope':                 m('slope',               answers.slope),
    'Truck Access':          m('yesno',               answers.truck_access),
    'Equipment Exit':        m('yesno',               answers.equipment_exit),
    'Delivery Recommendation': m('delivery',          report.delivery || 'tbd'),

    // ── Foundation
    'Surface Type':          m('surface',       answers.surface_type),
    'Ground Level':          m('ground_level',  answers.ground_level),
    'Temporary Removals':    removalText,
    'Clearance Around Pod':  m('yesno',         answers.clearance_around),
    'Foundation Status':     m('foundation',    answers.foundation_status),

    // ── Electrical
    'Panel Location Known':  answers.panel_location_known === 'yes',
    'Service Amperage':      m('amperage',  answers.service_amperage),
    'Panel to Pod Distance': m('distance',  answers.panel_distance),
    'Wiring Obstacles':      obstacleText,

    // ── Plumbing
    'Plumbing Applicable':   plannerSnap.podUse === 'guest_suite',
    'Water Line Known':      answers.water_line_known === 'yes',
    'Water Distance':        m('distance', answers.water_distance),
    'Sewer Type':            m('sewer',    answers.sewer_type),
    'Sewer Distance':        m('distance', answers.sewer_distance),

    // ── Internet
    'Internet Plan':         m('internet', answers.internet_plan),

    // ── Permitting
    'Permit Checked':        m('permit', answers.permit_checked),
    'HOA Status':            m('yesno',  answers.hoa_status),
    'Setback Awareness':     m('yesno',  answers.setback_awareness),

    // ── Summary
    'Overall Status':        m('overall', report.overallStatus || 'find_out'),
    "I Don't Know Count":    iDontKnowCount,
    'Section Statuses':      JSON.stringify({
      access:      report.accessStatus      || '',
      foundation:  report.foundationStatus  || '',
      electrical:  report.electricalStatus  || '',
      permitting:  report.permittingStatus  || '',
    }),
    'Notes': [
      answersText.surface_type    ? `Surface details: ${answersText.surface_type}`    : '',
      answersText.service_amperage ? `Amperage details: ${answersText.service_amperage}` : '',
    ].filter(Boolean).join('\n') || '',
  };
}

/* ── Handler ────────────────────────────────────────────────── */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const PAT = process.env.AIRTABLE_PAT;
  if (!PAT) {
    console.error('AIRTABLE_PAT env var is not set');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const fields = buildFields(data);

  try {
    const res = await fetch(AIRTABLE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('Airtable error:', json);
      return { statusCode: res.status, headers, body: JSON.stringify({ error: json.error?.message || 'Airtable error' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ id: json.id }) };

  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
