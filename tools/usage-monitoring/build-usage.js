// Emits the Usage_Monitoring .pbip (semantic model + report) for each environment.
const fs = require('fs'), path = require('path');
const G = require('./gen-usage.js');
const { ENVS, NAME, TABLES, DATE_DAX, DATE_COLS, DATE_HIERARCHIES, RELATIONSHIPS,
        PARAMS, THEME_SRC, guid, id20 } = G;
const { theme, BRAND } = require('./theme.js');

// Report features, and a bisect switch. Each was verified in Power BI Desktop
// one at a time, because a bad report construct makes Desktop drop every page
// with no usable error - the model still loads, so the model validator misses it.
//
//   theme   brand palette as the report's base theme          VERIFIED
//   vstyles the theme's visualStyles block                    VERIFIED
//   hier    drill-down hierarchies in visual projections      VERIFIED
//   chrome  branded header band + page title                  VERIFIED
//   pagenav built-in pageNavigator visual                     VERIFIED
//   nav     hand-rolled actionButtons      OFF - render unlabelled; pagenav replaces them
//   tips    tooltip + drillthrough pages   OFF - breaks the report layer
//
// Override to experiment, e.g. UM_FEATURES=theme,hier
const FEAT = (process.env.UM_FEATURES === undefined ? 'theme,vstyles,hier,chrome,pagenav' : process.env.UM_FEATURES)
  .split(',').map(s => s.trim()).filter(Boolean);
const has = f => FEAT.includes(f);

const W = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s, 'utf8'); };
const crlf = lines => lines.join('\r\n') + '\r\n';
const J = (p, o) => W(p, JSON.stringify(o, null, 2) + '\n');
const q = n => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : `'${n}'`;

function wipeContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

const summarizeFor = (name, type) =>
  (type === 'int64' || type === 'double') && !/_ID$|_HOUR$|^WAREHOUSE_ID$|RETENTION|^Year$|Sort$|No$/.test(name) ? 'sum' : 'none';

function columnTmdl(tableName, cn, ct, fmt, sortBy) {
  const L = [];
  L.push(`\tcolumn ${q(cn)}`);
  L.push(`\t\tdataType: ${ct}`);
  if (cn === 'Date') L.push(`\t\tisKey`);
  if (fmt) L.push(`\t\tformatString: ${fmt}`);
  L.push(`\t\tlineageTag: ${guid(tableName + '.' + cn)}`);
  // Without this, "Sep 2026" sorts alphabetically and the axis is nonsense.
  if (sortBy) L.push(`\t\tsortByColumn: ${q(sortBy)}`);
  L.push(`\t\tsummarizeBy: ${summarizeFor(cn, ct)}`);
  return L;
}

function hierarchyTmdl(tableName, [hName, levels]) {
  const L = [`\thierarchy ${q(hName)}`, `\t\tlineageTag: ${guid('h.' + tableName + '.' + hName)}`, ''];
  levels.forEach((lv, i) => {
    L.push(`\t\tlevel ${q(lv)}`);
    L.push(`\t\t\tlineageTag: ${guid('hl.' + tableName + '.' + hName + '.' + lv)}`);
    L.push(`\t\t\tcolumn: ${q(lv)}`, '');
  });
  return L;
}

function tableTmdl(t) {
  const L = [];
  if (t.doc) L.push(`/// ${t.doc}`);
  L.push(`table ${q(t.name)}`, `\tlineageTag: ${guid('t.' + t.name)}`, '');

  for (const [cn, ct, fmt, sortBy] of t.cols) {
    L.push(...columnTmdl(t.name, cn, ct, fmt, sortBy));
    L.push(`\t\tsourceColumn: ${cn}`, '');
    L.push(`\t\tannotation SummarizationSetBy = Automatic`, '');
  }

  for (const h of (t.hierarchies || [])) L.push(...hierarchyTmdl(t.name, h));

  for (const [mn, dax, fmt, doc] of (t.measures || [])) {
    if (doc) L.push(`\t/// ${doc}`);
    L.push(`\tmeasure ${q(mn)} = ${dax}`);
    if (fmt) L.push(`\t\tformatString: ${fmt}`);
    L.push(`\t\tlineageTag: ${guid('m.' + mn)}`, '');
  }

  // One line of SQL: TMDL cannot carry embedded newlines inside the M string,
  // and SQL does not care.
  //
  // The SQL is a plain literal, schema-qualified only. The database comes from
  // the Db navigation step, which already scopes the native query to it.
  // Previously the text was assembled at runtime with Text.Replace over the
  // SnowflakeDatabase / SnowflakeSchema parameters. Desktop's own Refresh applies
  // privacy-level partitioning that the engine refresh does not, and a query
  // whose TEXT depends on the same parameter that feeds its DATA SOURCE is what
  // that partitioner reports as "A cyclic reference was encountered during
  // evaluation" - which is how prod broke after Desktop updated to 2.157.1354.
  const sql = t.query.replace(/\{DB\}\.SNOWFLAKE\./g, 'SNOWFLAKE.')
                     .replace(/\s*\r?\n\s*/g, ' ').trim().replace(/"/g, '""');
  L.push(`\tpartition ${q(t.name)} = m`);
  L.push(`\t\tmode: import`);
  L.push(`\t\tsource =`);
  L.push(`\t\t\t\tlet`);
  L.push(`\t\t\t\t    Source = Snowflake.Databases(SnowflakeServer, SnowflakeWarehouse, [Role=SnowflakeRole]),`);
  L.push(`\t\t\t\t    Db = Source{[Name=SnowflakeDatabase, Kind="Database"]}[Data],`);
  L.push(`\t\t\t\t    Result = Value.NativeQuery(Db, "${sql}", null, [EnableFolding=true])`);
  L.push(`\t\t\t\tin`);
  L.push(`\t\t\t\t    Result`, '');
  L.push(`\tannotation PBI_ResultType = Table`, '');
  return crlf(L);
}

function dateTmdl() {
  const L = [`/// Date dimension derived from the loaded facts, so it always spans the data.`,
             `table 'Date'`, `\tlineageTag: ${guid('t.Date')}`, `\tdataCategory: Time`, ''];
  for (const [cn, ct, fmt, sortBy] of DATE_COLS) {
    L.push(...columnTmdl('Date', cn, ct, fmt, sortBy));
    L.push(`\t\tsourceColumn: [${cn}]`, '');
    L.push(`\t\tannotation SummarizationSetBy = Automatic`, '');
  }
  for (const h of DATE_HIERARCHIES) L.push(...hierarchyTmdl('Date', h));
  L.push(`\tpartition 'Date' = calculated`);
  L.push(`\t\tmode: import`);
  L.push(`\t\tsource =`);
  DATE_DAX.forEach(l => L.push(`\t\t\t\t${l}`));
  L.push('');
  return crlf(L);
}

function build(envName) {
  const env = ENVS[envName];
  // one folder per report: <env>_reports/<Name>/<Name>.{pbip,Report,SemanticModel}
  const base = `${env.root}/${NAME}/${NAME}`;
  const SM = `${base}.SemanticModel`, RP = `${base}.Report`;
  // Empty the folders rather than deleting them. A File Explorer window sitting
  // on the report folder locks the directory itself but not its children, and a
  // regeneration should not fail just because someone is looking at it.
  wipeContents(SM);
  wipeContents(RP);

  J(`${base}.pbip`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json',
    version: '1.0',
    artifacts: [{ report: { path: `${NAME}.Report` } }],
    settings: { enableAutoRecovery: true },
  });

  J(`${SM}/.platform`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
    metadata: { type: 'SemanticModel', displayName: NAME },
    config: { version: '2.0', logicalId: guid('sm.' + envName) },
  });
  J(`${SM}/definition.pbism`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json',
    version: '4.2', settings: {},
  });
  W(`${SM}/definition/database.tmdl`, crlf(['database', '\tcompatibilityLevel: 1606', '']));
  W(`${SM}/definition/cultures/en-US.tmdl`, crlf(['cultureInfo en-US']));

  const E = [];
  PARAMS.forEach(([pn, key, doc], i) => {
    if (i) E.push('');
    E.push(`/// ${doc}`);
    E.push(`expression ${pn} = "${env[key]}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]`);
    E.push(`\tlineageTag: ${guid('e.' + pn)}`, '');
    E.push(`\tannotation PBI_ResultType = Text`);
  });
  W(`${SM}/definition/expressions.tmdl`, crlf(E));

  TABLES.forEach(t => W(`${SM}/definition/tables/${t.name}.tmdl`, tableTmdl(t)));
  W(`${SM}/definition/tables/Date.tmdl`, dateTmdl());

  const R = [];
  RELATIONSHIPS.forEach(([ft, fc, tt, tc], i) => {
    if (i) R.push('');
    R.push(`relationship ${guid('r.' + tt + '.' + tc)}`);
    R.push(`\tfromColumn: ${q(tt)}.${tc}`);
    R.push(`\ttoColumn: ${q(ft)}.${fc}`);
  });
  W(`${SM}/definition/relationships.tmdl`, crlf(R));

  const names = TABLES.map(t => t.name).concat(['Date']);
  const M = ['model Model', '\tculture: en-US', '\tdefaultPowerBIDataSourceVersion: powerBI_V3',
    '\tsourceQueryCulture: en-GB', '\tdataAccessOptions', '\t\tlegacyRedirects', '\t\treturnErrorValuesAsNull', ''];
  M.push('annotation __PBI_TimeIntelligenceEnabled = 0', '');
  M.push('annotation PBI_ProTooling = ["DevMode"]', '');
  M.push(`annotation PBI_QueryOrder = ${JSON.stringify(PARAMS.map(p => p[0]).concat(TABLES.map(t => t.name)))}`, '');
  PARAMS.forEach(([pn]) => M.push(`ref expression ${pn}`));
  M.push('');
  names.forEach(n => M.push(`ref table ${q(n)}`));
  M.push('', 'ref cultureInfo en-US', '');
  W(`${SM}/definition/model.tmdl`, crlf(M));

  // ---- report ----
  J(`${RP}/.platform`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json',
    metadata: { type: 'Report', displayName: NAME },
    config: { version: '2.0', logicalId: guid('rp.' + envName) },
  });
  J(`${RP}/definition.pbir`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
    version: '4.0',
    datasetReference: { byPath: { path: `../${NAME}.SemanticModel` } },
  });
  J(`${RP}/definition/version.json`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json',
    version: '2.0.0',
  });

  // The brand palette ships as the report's BASE theme, not as a customTheme.
  // A customTheme entry - tried as both SharedResources and RegisteredResources -
  // makes Power BI reject the whole report layer: every page disappears while the
  // model still loads fine. baseTheme + SharedResources is exactly the shape the
  // working gold-model report uses, so only the file contents differ here.
  const THEME_NAME = has('theme') ? 'ArabianShield' : 'Fluent2-CY26SU08';
  if (has('theme')) {
    // visualStyles is the risky half of a theme: one unrecognised key can make
    // Power BI reject it. Keep it behind its own flag.
    const t = has('vstyles') ? theme : (({ visualStyles, ...rest }) => rest)(theme);
    J(`${RP}/StaticResources/SharedResources/BaseThemes/ArabianShield.json`, t);
  } else {
    fs.cpSync(THEME_SRC, `${RP}/StaticResources`, { recursive: true });
  }

  J(`${RP}/definition/report.json`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.2.0/schema.json',
    themeCollection: {
      baseTheme: { name: THEME_NAME, reportVersionAtImport: { visual: '2.12.0', report: '3.4.0', page: '2.3.1' }, type: 'SharedResources' },
    },
    resourcePackages: [
      { name: 'SharedResources', type: 'SharedResources', items: [
        { name: THEME_NAME, path: `BaseThemes/${THEME_NAME}.json`, type: 'BaseTheme' },
      ] },
    ],
    settings: {
      useStylableVisualContainerHeader: true, exportDataMode: 'AllowSummarized',
      defaultDrillFilterOtherVisuals: true, allowChangeFilterTypes: true,
      useEnhancedTooltips: true, useDefaultAggregateDisplayName: true,
    },
  });

  const PAGES = require('./pages.js')(id20, BRAND, env, has);
  const order = [];
  PAGES.forEach(pg => {
    const pid = id20('page.' + pg.name);
    // Every page folder on disk must appear in pageOrder. Tooltip and
    // drillthrough pages are hidden via `visibility`, not by omission - leaving
    // them out of pageOrder makes the whole page set invalid and Power BI drops
    // every tab.
    order.push(pid);
    const page = {
      $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
      name: pid, displayName: pg.name, displayOption: 'FitToPage',
      height: pg.h || 720, width: pg.w || 1280,
    };
    if (pg.pageBinding) page.pageBinding = pg.pageBinding;
    if (pg.filterConfig) page.filterConfig = pg.filterConfig;
    if (pg.hidden) page.visibility = 'HiddenInViewMode';
    J(`${RP}/definition/pages/${pid}/page.json`, page);

    pg.visuals.forEach((v, vi) => {
      const vid = id20('vis.' + pg.name + '.' + vi);
      const visual = { visualType: v.type, drillFilterOtherVisuals: true };
      if (v.q) visual.query = { queryState: v.q };
      if (v.objects) visual.objects = v.objects;
      if (v.visualContainerObjects) visual.visualContainerObjects = v.visualContainerObjects;
      const container = {
        $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.8.0/schema.json',
        name: vid,
        position: { x: v.x, y: v.y, z: v.z != null ? v.z : vi, height: v.h, width: v.w, tabOrder: vi * 10 },
      };
      if (v.type === 'textbox' || v.type === 'shape' || v.type === 'actionButton') {
        container.visual = visual;
      } else {
        container.visual = visual;
      }
      J(`${RP}/definition/pages/${pid}/visuals/${vid}/visual.json`, container);
    });
  });
  J(`${RP}/definition/pages/pages.json`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json',
    pageOrder: order, activePageName: order[0],
  });

  const nVis = PAGES.reduce((a, p) => a + p.visuals.length, 0);
  const nMeas = TABLES.reduce((a, t) => a + (t.measures || []).length, 0);
  const nHier = TABLES.reduce((a, t) => a + (t.hierarchies || []).length, 0) + DATE_HIERARCHIES.length;
  console.log(`${envName.padEnd(5)} -> ${base}.pbip`);
  console.log(`        tables=${names.length} measures=${nMeas} hierarchies=${nHier} pages=${PAGES.length} visuals=${nVis}  [${env.server} / ${env.warehouse}]`);
}

Object.keys(ENVS).forEach(build);
