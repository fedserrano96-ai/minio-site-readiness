/*
 * Mini·O permitting research helper — fetch and archive official sources.
 *
 * This script does NO rule interpretation. Given a jurisdiction id and a list of
 * official source URLs, it fetches each page, saves a raw snapshot with the URL and
 * access date stamped, and (if missing) emits a blank schema-shaped skeleton entry
 * for the drafting session to fill in. Drafting rules from these snapshots happens
 * in a supervised Claude Code session; every citation must trace to a snapshot here.
 *
 * Everything downstream of this stays status: "draft". Only Fred flips to verified.
 *
 * Usage:
 *   node fetch-sources.js <jurisdiction-id> <url> [url ...]
 *   node fetch-sources.js <jurisdiction-id> --from-data   (re-fetch URLs cited in data/jurisdictions.json)
 *
 * Output:
 *   research/sources/<jurisdiction-id>/NNN-<host>.html   raw snapshots
 *   research/sources/<jurisdiction-id>/manifest.json     url, fetched_at, http_status, file, bytes
 *   research/drafts/<jurisdiction-id>.skeleton.json      blank template (only if missing)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const DATA_FILE = path.join(__dirname, '..', 'data', 'jurisdictions.json');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MiniO-Permitting-Research/0.2 (manual research archive; contact: fedserrano96@gmail.com)';

function slugify(url) {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80).toLowerCase();
  } catch (e) {
    return 'invalid-url';
  }
}

function collectCitedUrls(jurisdictionId) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const jur = (data.jurisdictions || []).find((j) => j.id === jurisdictionId);
  if (!jur) {
    console.error('Jurisdiction not found in data file: ' + jurisdictionId);
    process.exit(1);
  }
  const urls = new Set();
  if (jur.authority && jur.authority.url && jur.authority.url.indexOf('<<') === -1) {
    urls.add(jur.authority.url);
  }
  (jur.rules || []).forEach((r) => {
    if (r.citation && r.citation.url && r.citation.url.indexOf('<<') === -1) {
      urls.add(r.citation.url);
    }
  });
  return Array.from(urls);
}

async function fetchOne(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: '', error: String(err && err.message ? err.message : err) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node fetch-sources.js <jurisdiction-id> <url> [url ...]');
    console.error('       node fetch-sources.js <jurisdiction-id> --from-data');
    process.exit(1);
  }

  const jurisdictionId = args[0];
  const urls = args[1] === '--from-data' ? collectCitedUrls(jurisdictionId) : args.slice(1);

  if (!urls.length) {
    console.log('No URLs to fetch for ' + jurisdictionId + '.');
    return;
  }

  const outDir = path.join(ROOT, 'sources', jurisdictionId);
  fs.mkdirSync(outDir, { recursive: true });

  const manifestPath = path.join(outDir, 'manifest.json');
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const fetchedAt = new Date().toISOString();
  let n = manifest.length;

  for (const url of urls) {
    n++;
    const file = String(n).padStart(3, '0') + '-' + slugify(url) + '.html';
    process.stdout.write('Fetching ' + url + ' ... ');
    const result = await fetchOne(url);
    const entry = {
      url: url,
      fetched_at: fetchedAt,
      http_status: result.status,
      file: result.status >= 200 && result.status < 400 ? file : null,
      bytes: result.body.length,
      error: result.error || null,
    };
    if (entry.file) {
      const header =
        '<!-- Archived by fetch-sources.js\n  url: ' + url + '\n  fetched_at: ' + fetchedAt +
        '\n  http_status: ' + result.status + '\n-->\n';
      fs.writeFileSync(path.join(outDir, file), header + result.body, 'utf8');
      console.log('OK (' + result.status + ', ' + result.body.length + ' bytes)');
    } else {
      console.log('FAILED (' + (result.error || 'HTTP ' + result.status) + ')');
    }
    manifest.push(entry);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Manifest: ' + manifestPath);

  /* Emit a blank skeleton for the drafting session if one doesn't exist yet. */
  const draftsDir = path.join(ROOT, 'drafts');
  fs.mkdirSync(draftsDir, { recursive: true });
  const skeletonPath = path.join(draftsDir, jurisdictionId + '.skeleton.json');
  if (!fs.existsSync(skeletonPath)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const skeleton = JSON.parse(JSON.stringify(data.template));
    skeleton.id = jurisdictionId;
    skeleton.status = 'draft'; /* hard-coded on purpose: this tool never writes "verified" */
    fs.writeFileSync(skeletonPath, JSON.stringify(skeleton, null, 2), 'utf8');
    console.log('Skeleton: ' + skeletonPath);
  }

  const failures = manifest.filter((m) => !m.file);
  if (failures.length) {
    console.log('\n' + failures.length + ' fetch(es) failed — cite these only as <<verify>> until archived:');
    failures.forEach((f) => console.log('  - ' + f.url));
  }
}

main();
