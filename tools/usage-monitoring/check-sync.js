// Compare the dev and prod copies of a report and classify every difference as
// either EXPECTED (things that must differ per environment) or DRIFT.
//
// The two copies are generated from one definition, so anything beyond the
// connection parameters, the environment badge and the Fabric logicalId means
// they have fallen out of sync - usually because one side was hand-edited in
// Desktop and the other was not.
//
// usage: node check-sync.js [reportName]
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..');
const NAME = process.argv[2] || 'Usage_Monitoring';
const DEV = path.join(REPO, 'dev_reports', NAME);
const PROD = path.join(REPO, 'prod_reports', NAME);

const walk = (root, base = '') => {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const e of fs.readdirSync(root)) {
    // .pbi/ holds Desktop's gitignored local state (credential binding, cache);
    // it is per-machine, not part of the report, so it is not a sync concern.
    if (e === '.pbi') continue;
    const abs = path.join(root, e), rel = base ? base + '/' + e : e;
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
};

const devFiles = new Set(walk(DEV));
const prodFiles = new Set(walk(PROD));

const onlyDev = [...devFiles].filter(f => !prodFiles.has(f));
const onlyProd = [...prodFiles].filter(f => !devFiles.has(f));

// Connection parameters and the environment badge are meant to differ.
const PARAM_LINE = /^expression Snowflake(Server|Warehouse|Role|Database|Schema) =/;
const expected = [], drift = [];

for (const f of [...devFiles].filter(x => prodFiles.has(x))) {
  const a = fs.readFileSync(path.join(DEV, f), 'utf8');
  const b = fs.readFileSync(path.join(PROD, f), 'utf8');
  if (a === b) continue;

  const al = a.split(/\r?\n/), bl = b.split(/\r?\n/);
  const diffs = [];
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i++) if (al[i] !== bl[i]) diffs.push([al[i] ?? '', bl[i] ?? '']);

  const classify = ([x, y]) => {
    const t = x.trim(), u = y.trim();
    if (PARAM_LINE.test(t) && PARAM_LINE.test(u)) return 'param';
    // The connection is inlined per environment, so this one M line differs by
    // design (server / warehouse / role / database literals).
    if (/Source = Snowflake\.Databases\(/.test(t) && /Source = Snowflake\.Databases\(/.test(u)) return 'connection';
    if (/"value":\s*"(DEV|PROD)"/.test(t) && /"value":\s*"(DEV|PROD)"/.test(u)) return 'badge';
    if (/"logicalId"/.test(t) && /"logicalId"/.test(u)) return 'logicalId';
    // Per-machine Desktop-save artefacts, not report content: the last-viewed
    // page tab, and the schema-version stamp Desktop writes for its own build.
    if (/"activePageName"/.test(t) && /"activePageName"/.test(u)) return 'activeTab';
    if (/pagesMetadata\/[\d.]+\/schema/.test(t) && /pagesMetadata\/[\d.]+\/schema/.test(u)) return 'schemaStamp';
    return 'drift';
  };
  const kinds = new Set(diffs.map(classify));
  (kinds.has('drift') ? drift : expected).push({ f, lines: diffs.length, kinds: [...kinds].join(',') });
}

console.log(`dev  : ${devFiles.size} files`);
console.log(`prod : ${prodFiles.size} files`);
console.log('');
if (onlyDev.length)  { console.log(`ONLY IN DEV (${onlyDev.length}):`);  onlyDev.forEach(f => console.log('  ' + f)); }
if (onlyProd.length) { console.log(`ONLY IN PROD (${onlyProd.length}):`); onlyProd.forEach(f => console.log('  ' + f)); }
if (!onlyDev.length && !onlyProd.length) console.log('file sets match');
console.log('');
console.log(`expected differences : ${expected.length} file(s)`);
const byKind = {};
expected.forEach(e => { byKind[e.kinds] = (byKind[e.kinds] || 0) + 1; });
Object.entries(byKind).forEach(([k, v]) => console.log(`   ${k.padEnd(12)} ${v} file(s)`));
console.log('');
if (drift.length === 0 && !onlyDev.length && !onlyProd.length) {
  console.log('IN SYNC - the only differences are per-environment by design.');
  process.exit(0);
}
console.log(`DRIFT: ${drift.length} file(s) differ beyond the environment`);
drift.forEach(d => console.log(`  ! ${d.f}  (${d.lines} differing line(s), kinds: ${d.kinds})`));
process.exit(1);
