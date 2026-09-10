// Emits the Usage_Monitoring .pbip (semantic model + report) for each environment.
const fs = require('fs'), path = require('path');
const G = require('./gen-usage.js');
const { ENVS, NAME, TABLES, DATE_DAX, DATE_COLS, RELATIONSHIPS, PARAMS, THEME_SRC, guid, id20 } = G;

const W = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s, 'utf8'); };
const crlf = lines => lines.join('\r\n') + '\r\n';
const J = (p, o) => W(p, JSON.stringify(o, null, 2) + '\n');

// Identifiers needing quotes in TMDL / DAX get wrapped.
const q = n => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : `'${n}'`;

const summarizeFor = (name, type) =>
  (type === 'int64' || type === 'double') && !/_ID$|_HOUR$|^WAREHOUSE_ID$|RETENTION/.test(name) ? 'sum' : 'none';

// --------------------------------------------------------------- tables ----
function tableTmdl(t) {
  const L = [`table ${q(t.name)}`];
  if (t.doc) L.splice(0, 0, `/// ${t.doc}`);
  L.push(`\tlineageTag: ${guid('t.' + t.name)}`, '');

  for (const [cn, ct, fmt] of t.cols) {
    L.push(`\tcolumn ${q(cn)}`);
    L.push(`\t\tdataType: ${ct}`);
    if (fmt) L.push(`\t\tformatString: ${fmt}`);
    L.push(`\t\tlineageTag: ${guid(t.name + '.' + cn)}`);
    L.push(`\t\tsummarizeBy: ${summarizeFor(cn, ct)}`);
    L.push(`\t\tsourceColumn: ${cn}`, '');
    L.push(`\t\tannotation SummarizationSetBy = Automatic`, '');
  }

  for (const [mn, dax, fmt, doc] of (t.measures || [])) {
    if (doc) L.push(`\t/// ${doc}`);
    L.push(`\tmeasure ${q(mn)} = ${dax}`);
    if (fmt) L.push(`\t\tformatString: ${fmt}`);
    L.push(`\t\tlineageTag: ${guid('m.' + mn)}`, '');
  }

  // One line of SQL: TMDL cannot carry embedded newlines inside the M string,
  // and SQL does not care. {DB}/{SCHEMA} stay parameter-driven via Text.Replace.
  const sql = t.query.replace(/\{DB\}\.SNOWFLAKE\./g, '{DB}.{SCHEMA}.')
                     .replace(/\s*\r?\n\s*/g, ' ').trim().replace(/"/g, '""');
  L.push(`\tpartition ${q(t.name)} = m`);
  L.push(`\t\tmode: import`);
  L.push(`\t\tsource =`);
  L.push(`\t\t\t\tlet`);
  L.push(`\t\t\t\t    Source = Snowflake.Databases(SnowflakeServer, SnowflakeWarehouse, [Role=SnowflakeRole]),`);
  L.push(`\t\t\t\t    Db = Source{[Name=SnowflakeDatabase, Kind="Database"]}[Data],`);
  L.push(`\t\t\t\t    Sql = Text.Replace(Text.Replace("${sql}", "{DB}", SnowflakeDatabase), "{SCHEMA}", SnowflakeSchema),`);
  L.push(`\t\t\t\t    Result = Value.NativeQuery(Db, Sql, null, [EnableFolding=true])`);
  L.push(`\t\t\t\tin`);
  L.push(`\t\t\t\t    Result`, '');
  L.push(`\tannotation PBI_ResultType = Table`, '');
  return crlf(L);
}

function dateTmdl() {
  const L = [`/// Date dimension derived from the loaded facts, so it always spans the data.`,
             `table 'Date'`, `\tlineageTag: ${guid('t.Date')}`, `\tdataCategory: Time`, ''];
  for (const [cn, ct, fmt] of DATE_COLS) {
    L.push(`\tcolumn ${q(cn)}`);
    L.push(`\t\tdataType: ${ct}`);
    if (cn === 'Date') L.push(`\t\tisKey`);
    if (fmt) L.push(`\t\tformatString: ${fmt}`);
    L.push(`\t\tlineageTag: ${guid('Date.' + cn)}`);
    L.push(`\t\tsummarizeBy: none`);
    L.push(`\t\tsourceColumn: [${cn}]`, '');
    L.push(`\t\tannotation SummarizationSetBy = Automatic`, '');
  }
  L.push(`\tpartition 'Date' = calculated`);
  L.push(`\t\tmode: import`);
  L.push(`\t\tsource =`);
  DATE_DAX.forEach(l => L.push(`\t\t\t\t${l}`));
  L.push('');
  return crlf(L);
}

// -------------------------------------------------------------- writer -----
function build(envName) {
  const env = ENVS[envName];
  // one folder per report: <env>_reports/<Name>/<Name>.{pbip,Report,SemanticModel}
  const base = `${env.root}/${NAME}/${NAME}`;
  const SM = `${base}.SemanticModel`, RP = `${base}.Report`;
  fs.rmSync(SM, { recursive: true, force: true });
  fs.rmSync(RP, { recursive: true, force: true });

  // ---- pbip
  J(`${base}.pbip`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json',
    version: '1.0',
    artifacts: [{ report: { path: `${NAME}.Report` } }],
    settings: { enableAutoRecovery: true },
  });

  // ---- semantic model scaffolding
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

  // ---- parameters
  const E = [];
  PARAMS.forEach(([pn, key, doc], i) => {
    if (i) E.push('');
    E.push(`/// ${doc}`);
    E.push(`expression ${pn} = "${env[key]}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]`);
    E.push(`\tlineageTag: ${guid('e.' + pn)}`, '');
    E.push(`\tannotation PBI_ResultType = Text`);
  });
  W(`${SM}/definition/expressions.tmdl`, crlf(E));

  // ---- tables
  TABLES.forEach(t => W(`${SM}/definition/tables/${t.name}.tmdl`, tableTmdl(t)));
  W(`${SM}/definition/tables/Date.tmdl`, dateTmdl());

  // ---- relationships (star: Date -> each fact, single direction)
  const R = [];
  RELATIONSHIPS.forEach(([ft, fc, tt, tc], i) => {
    if (i) R.push('');
    R.push(`relationship ${guid('r.' + tt + '.' + tc)}`);
    R.push(`\tfromColumn: ${q(tt)}.${tc}`);   // many side
    R.push(`\ttoColumn: ${q(ft)}.${fc}`);     // one side
  });
  W(`${SM}/definition/relationships.tmdl`, crlf(R));

  // ---- model
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

  // ---- report scaffolding
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
  fs.cpSync(THEME_SRC, `${RP}/StaticResources`, { recursive: true });
  J(`${RP}/definition/report.json`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.2.0/schema.json',
    themeCollection: { baseTheme: { name: 'Fluent2-CY26SU08', reportVersionAtImport: { visual: '2.12.0', report: '3.4.0', page: '2.3.1' }, type: 'SharedResources' } },
    resourcePackages: [{ name: 'SharedResources', type: 'SharedResources', items: [{ name: 'Fluent2-CY26SU08', path: 'BaseThemes/Fluent2-CY26SU08.json', type: 'BaseTheme' }] }],
    settings: { useStylableVisualContainerHeader: true, exportDataMode: 'AllowSummarized', defaultDrillFilterOtherVisuals: true, allowChangeFilterTypes: true, useEnhancedTooltips: true, useDefaultAggregateDisplayName: true },
  });

  const PAGES = require('./pages.js');
  const order = [];
  PAGES.forEach((pg, pi) => {
    const pid = id20('page.' + pg.name);
    order.push(pid);
    J(`${RP}/definition/pages/${pid}/page.json`, {
      $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json',
      name: pid, displayName: pg.name, displayOption: 'FitToPage', height: 720, width: 1280,
    });
    pg.visuals.forEach((v, vi) => {
      const vid = id20('vis.' + pg.name + '.' + vi);
      J(`${RP}/definition/pages/${pid}/visuals/${vid}/visual.json`, {
        $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.8.0/schema.json',
        name: vid,
        position: { x: v.x, y: v.y, z: vi, height: v.h, width: v.w, tabOrder: vi * 10 },
        visual: { visualType: v.type, query: { queryState: v.q }, drillFilterOtherVisuals: true },
      });
    });
  });
  J(`${RP}/definition/pages/pages.json`, {
    $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json',
    pageOrder: order, activePageName: order[0],
  });

  const nVis = PAGES.reduce((a, p) => a + p.visuals.length, 0);
  const nMeas = TABLES.reduce((a, t) => a + (t.measures || []).length, 0);
  console.log(`${envName.padEnd(5)} -> ${base}.pbip   tables=${names.length} measures=${nMeas} pages=${PAGES.length} visuals=${nVis}  [${env.server} / ${env.warehouse}]`);
}

Object.keys(ENVS).forEach(build);
