// Cross-check every field the report references against what the model actually
// defines. A visual pointing at a measure or column that does not exist makes
// Power BI drop the report layer with no usable message, so catching it here is
// far cheaper than a 90s Desktop launch.
//
// usage: node check-refs.js [<path to the .Report folder>] [<path to .SemanticModel folder>]
const fs = require('fs'), path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const RP = process.argv[2] || path.join(REPO, 'dev_reports', 'Usage_Monitoring', 'Usage_Monitoring.Report');
const SM = process.argv[3] || path.join(REPO, 'dev_reports', 'Usage_Monitoring', 'Usage_Monitoring.SemanticModel');

// ---- what the model defines ------------------------------------------------
const model = { columns: new Map(), measures: new Map(), hierarchies: new Map() };
const tablesDir = path.join(SM, 'definition', 'tables');
for (const f of fs.readdirSync(tablesDir)) {
  const t = f.replace(/\.tmdl$/, '');
  const txt = fs.readFileSync(path.join(tablesDir, f), 'utf8');
  const strip = s => s.trim().replace(/^'|'$/g, '');
  model.columns.set(t, new Set([...txt.matchAll(/^\tcolumn (.+)$/gm)].map(m => strip(m[1]))));
  model.measures.set(t, new Set([...txt.matchAll(/^\tmeasure (.+?)\s*=/gm)].map(m => strip(m[1]))));
  const hs = new Map();
  const hre = /^\thierarchy (.+)$/gm; let hm;
  while ((hm = hre.exec(txt))) {
    const hName = strip(hm[1]);
    const rest = txt.slice(hm.index, (hre.lastIndex + 4000));
    const levels = new Set([...rest.matchAll(/^\t\tlevel (.+)$/gm)].map(m => strip(m[1])));
    hs.set(hName, levels);
  }
  model.hierarchies.set(t, hs);
}

// ---- what the report references --------------------------------------------
const problems = [];
const seen = { measures: 0, columns: 0, levels: 0 };
const pagesDir = path.join(RP, 'definition', 'pages');

function walkFields(node, where) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(n => walkFields(n, where));

  if (node.Measure && node.Measure.Expression && node.Measure.Expression.SourceRef) {
    const e = node.Measure.Expression.SourceRef.Entity, p = node.Measure.Property;
    seen.measures++;
    if (!model.measures.has(e)) problems.push(`${where}: measure on unknown table '${e}'`);
    else if (!model.measures.get(e).has(p)) problems.push(`${where}: MEASURE NOT FOUND  ${e}[${p}]`);
  }
  if (node.Column && node.Column.Expression && node.Column.Expression.SourceRef) {
    const e = node.Column.Expression.SourceRef.Entity, p = node.Column.Property;
    seen.columns++;
    if (!model.columns.has(e)) problems.push(`${where}: column on unknown table '${e}'`);
    else if (!model.columns.get(e).has(p)) problems.push(`${where}: COLUMN NOT FOUND  ${e}[${p}]`);
  }
  if (node.HierarchyLevel && node.HierarchyLevel.Expression && node.HierarchyLevel.Expression.Hierarchy) {
    const hx = node.HierarchyLevel.Expression.Hierarchy;
    const e = hx.Expression.SourceRef.Entity, h = hx.Hierarchy, lv = node.HierarchyLevel.Level;
    seen.levels++;
    const hs = model.hierarchies.get(e);
    if (!hs) problems.push(`${where}: hierarchy on unknown table '${e}'`);
    else if (!hs.has(h)) problems.push(`${where}: HIERARCHY NOT FOUND  ${e}.${h}`);
    else if (!hs.get(h).has(lv)) problems.push(`${where}: LEVEL NOT FOUND  ${e}.${h}.${lv}`);
  }
  for (const k of Object.keys(node)) walkFields(node[k], where);
}

const pageIds = fs.readdirSync(pagesDir).filter(d => fs.statSync(path.join(pagesDir, d)).isDirectory());
const pageNames = {};
for (const pidDir of pageIds) {
  const pj = JSON.parse(fs.readFileSync(path.join(pagesDir, pidDir, 'page.json'), 'utf8'));
  pageNames[pidDir] = pj.displayName;
  const vdir = path.join(pagesDir, pidDir, 'visuals');
  if (!fs.existsSync(vdir)) continue;
  for (const vid of fs.readdirSync(vdir)) {
    const vp = path.join(vdir, vid, 'visual.json');
    if (!fs.existsSync(vp)) continue;
    const v = JSON.parse(fs.readFileSync(vp, 'utf8'));
    walkFields(v, `${pj.displayName}/${v.visual && v.visual.visualType}`);
  }
}

// pageOrder must cover exactly the page folders present
const meta = JSON.parse(fs.readFileSync(path.join(pagesDir, 'pages.json'), 'utf8'));
const inOrder = new Set(meta.pageOrder);
for (const d of pageIds) if (!inOrder.has(d)) problems.push(`pages.json: page '${pageNames[d]}' on disk but missing from pageOrder`);
for (const o of meta.pageOrder) if (!pageIds.includes(o)) problems.push(`pages.json: pageOrder lists '${o}' with no folder`);
if (!inOrder.has(meta.activePageName)) problems.push(`pages.json: activePageName not in pageOrder`);

// page-navigation and tooltip targets must resolve to real pages
for (const pidDir of pageIds) {
  const vdir = path.join(pagesDir, pidDir, 'visuals');
  if (!fs.existsSync(vdir)) continue;
  for (const vid of fs.readdirSync(vdir)) {
    const vp = path.join(vdir, vid, 'visual.json');
    if (!fs.existsSync(vp)) continue;
    const raw = fs.readFileSync(vp, 'utf8');
    for (const m of raw.matchAll(/"(navigationSection|section)":\s*\{\s*"expr":\s*\{\s*"Literal":\s*\{\s*"Value":\s*"'([^']+)'"/g)) {
      if (!pageIds.includes(m[2])) problems.push(`${pageNames[pidDir]}: ${m[1]} points at '${m[2]}' which is not a page`);
    }
  }
}

console.log(`pages     : ${pageIds.length}`);
console.log(`refs seen : ${seen.measures} measures, ${seen.columns} columns, ${seen.levels} hierarchy levels`);
if (problems.length === 0) { console.log('\nOK - every report reference resolves against the model.'); process.exit(0); }
console.log(`\nFAILED - ${problems.length} problem(s):`);
[...new Set(problems)].forEach(p => console.log('  ! ' + p));
process.exit(1);
