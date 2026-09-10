// Report pages for Usage_Monitoring.
// Canvas 1280x720.  header y=0..52 | slicers y=60..104 | KPIs y=112..196
//                   charts row 1 y=204..452 | charts row 2 y=460..708
module.exports = function (id20, BRAND, env, has) {
  has = has || (() => true);

// ---- field helpers ---------------------------------------------------------
const col = (e, p, as) => ({
  field: { Column: { Expression: { SourceRef: { Entity: e } }, Property: p } },
  queryRef: `${e}.${p}`, nativeQueryRef: as || p,
});
const meas = (e, n) => ({
  field: { Measure: { Expression: { SourceRef: { Entity: e } }, Property: n } },
  queryRef: `${e}.${n}`, nativeQueryRef: n,
});
const hierRaw = (e, h, lv) => ({
  field: { HierarchyLevel: { Expression: { Hierarchy: { Expression: { SourceRef: { Entity: e } }, Hierarchy: h } }, Level: lv } },
  queryRef: `${e}.${h}.${lv}`, nativeQueryRef: lv,
});
const hier = (e, h, lv) => has('hier') ? hierRaw(e, h, lv) : col(e, lv);
const P = (...f) => ({ projections: f });
const lit = v => ({ expr: { Literal: { Value: v } } });
const str = s => lit(`'${s}'`);

const DC = 'Daily_Consumption', HC = 'Hourly_Consumption', DR = 'DTS_Refresh',
      TS = 'Table_Snapshots', CT = 'Current_Tables', DT = 'Date';

// page ids must be resolvable before the pages are emitted, so derive them the
// same way the builder does
const pid = name => id20('page.' + name);
const NAV = ['Overview', 'Cost & Consumption', 'Pipeline Health', 'Data Growth', 'Table Inventory',
             'Warehouse Efficiency', 'Refresh Deep Dive', 'Freshness & SLA', 'Executive Summary'];
const TIP_TABLE = 'Tooltip - Table';
const TIP_DAY   = 'Tooltip - Day';
const DRILL     = 'Table Detail';

// ---- chrome ----------------------------------------------------------------
const textbox = (x, y, w, h, runs, align) => ({
  type: 'textbox', x, y, w, h, z: 900,
  objects: { general: [{ properties: { paragraphs: [{ horizontalTextAlignment: align || 'left', textRuns: runs }] } }] },
});

const headerBandRaw = (title, subtitle) => ([
  // solid brand band behind the title
  {
    type: 'shape', x: 0, y: 0, w: 1280, h: 52, z: 800,
    objects: {
      shapeCustomRectangle: [{ properties: { roundEdge: lit('0D') } }],
      fill: [{ properties: { show: lit('true'), fillColor: { solid: { color: str(BRAND.green) } }, transparency: lit('0D') } }],
      outline: [{ properties: { show: lit('false') } }],
    },
  },
  textbox(14, 4, 430, 44, [
    { value: 'ARABIAN SHIELD', textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '12pt', color: '#FFFFFF' } },
    { value: '  ' + title, textStyle: { fontFamily: 'Segoe UI Light', fontSize: '12pt', color: '#C9DBB9' } },
  ]),
  textbox(1150, 14, 120, 26, [
    { value: env.label, textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '9pt', color: '#FFFFFF' } },
  ], 'right'),
]);

const headerBand = (t, s) => has('chrome') ? headerBandRaw(t, s) : [];

// Power BI's built-in page navigator: it generates one labelled button per
// visible page and highlights the current one, with no hand-rolled button JSON.
// Hand-built actionButtons rendered as unlabelled boxes - their `text` object was
// never applied, even with an explicit default-state selector.
const pageNav = () => !has('pagenav') ? [] : [{
  type: 'pageNavigator', x: 300, y: 8, w: 838, h: 36, z: 940,
  objects: {
    fill: [{ properties: { show: lit('true'), fillColor: { solid: { color: str(BRAND.white) } } } }],
    text: [{ properties: { fontColor: { solid: { color: str(BRAND.green) } }, fontSize: lit('9D'),
                           fontFamily: str('Segoe UI Semibold') } }],
    selectedFill: [{ properties: { fillColor: { solid: { color: str(BRAND.lime) } } } }],
    shape: [{ properties: { roundedCorners: lit('4D') } }],
  },
}];

// Legacy hand-rolled buttons, kept behind the `nav` flag for reference.
const navButtons = (current) => !has('nav') ? [] : NAV.map((n, i) => ({
  type: 'actionButton', x: 452 + i * 138, y: 11, w: 132, h: 30, z: 950,
  objects: {
    text: [{ properties: {
      show: lit('true'), text: str(n),
      fontColor: { solid: { color: str(n === current ? BRAND.white : BRAND.green) } },
      fontSize: lit('9D'), fontFamily: str('Segoe UI Semibold'),
      horizontalAlignment: str('center'), verticalAlignment: str('middle'),
    }, selector: { id: 'default' } }],
    fill: [{ properties: {
      show: lit('true'), transparency: lit('0D'),
      fillColor: { solid: { color: str(n === current ? BRAND.green : BRAND.white) } },
    }, selector: { id: 'default' } }],
    outline: [{ properties: { show: lit('true'), lineColor: { solid: { color: str(BRAND.line) } }, weight: lit('1D') }, selector: { id: 'default' } }],
  },
  visualContainerObjects: {
    visualLink: [{ properties: { show: lit('true'), type: str('PageNavigation'), navigationSection: str(pid(n)) } }],
  },
}));

// ---- slicers ---------------------------------------------------------------
const slicer = (x, y, w, h, field, mode) => ({
  type: 'slicer', x, y, w, h,
  q: { Values: P(field) },
  ...(has('objects') ? { objects: { data: [{ properties: { mode: str(mode || 'Basic') } }] } } : {}),
});

const dateSlicer   = slicer(12, 60, 340, 44, col(DT, 'Date'), 'Between');
const layerSlicer  = (e) => slicer(360, 60, 300, 44, col(e, 'LAYER'), 'Basic');
const monthSlicer  = slicer(668, 60, 300, 44, col(DT, 'Month Name'), 'Basic');

// attach a report-page tooltip to a visual
const withTip = (v, tipPage) => !has('tips') ? v : ({
  ...v,
  visualContainerObjects: {
    ...(v.visualContainerObjects || {}),
    tooltip: [{ properties: { show: lit('true'), type: str('ReportPage'), section: str(pid(tipPage)) } }],
  },
});

// ---- layout constants ------------------------------------------------------
const KPI_Y = 112, KPI_H = 84, R1_Y = 204, R2_Y = 460, ROW_H = 248;
const L = 12, R = 650, HALF = 618, FULL = 1256;

// The modern cardVisual reads its figure from the "Data" role. Bound to
// "Values" - which is what tableEx and slicers use - it renders an empty card
// with no error, which is exactly how every KPI came up blank.
const cards = (items) => items.map((m, i) => ({
  type: 'cardVisual', x: 12 + i * 211, y: KPI_Y, w: 201, h: KPI_H,
  q: { Data: P(meas(m[0], m[1])) },
}));

const page = (name, title, subtitle, slicers, visuals, extra) => ({
  name, ...extra,
  visuals: [...headerBand(title, subtitle), ...pageNav(), ...navButtons(name), ...slicers, ...visuals],
});

// ============================================================ pages =========
const PAGES = [
  page('Overview', 'Usage Monitoring', 'Snowflake platform telemetry',
    [dateSlicer, layerSlicer(CT), monthSlicer],
    [
      ...cards([[DC, 'Estimated Cost'], [DC, 'Total Credits'], [CT, 'Tables Monitored'],
                [TS, 'Rows (Latest)'], [DR, 'Success Rate %'], [DR, 'Target Lag Breach %']]),
      withTip({ type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DC, 'Estimated Cost'), meas(DC, 'Credits 7D Avg')) } }, TIP_DAY),
      { type: 'clusteredColumnChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DR, 'LAYER')), Y: P(meas(DR, 'Total Refreshes'), meas(DR, 'Failed Refreshes')) } },
      { type: 'clusteredBarChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(hier(CT, 'Inventory', 'LAYER')), Y: P(meas(CT, 'Current Rows'), meas(CT, 'Current Storage GB')) } },
      withTip({ type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(CT, 'LAYER'), meas(CT, 'Tables Monitored'), meas(CT, 'Dynamic Tables'),
                       meas(CT, 'Empty Tables'), meas(CT, 'Current Storage GB')) } }, TIP_TABLE),
    ]),

  page('Cost & Consumption', 'Cost & Consumption', 'Credits, spend and warehouse burn',
    [dateSlicer, monthSlicer],
    [
      ...cards([[DC, 'Estimated Cost'], [DC, 'Cost MTD'], [DC, 'Avg Daily Cost'],
                [DC, 'Run Rate (30d) USD'], [DC, 'Cost WoW %'], [DC, 'Cloud Services %']]),
      withTip({ type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DC, 'Total Credits'), meas(DC, 'Compute Credits'), meas(DC, 'Cloud Services Credits')) } }, TIP_DAY),
      { type: 'clusteredColumnChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(hier(DT, 'Calendar', 'Month Name')), Y: P(meas(DC, 'Estimated Cost')) } },
      { type: 'clusteredBarChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(HC, 'WAREHOUSE_NAME')), Y: P(meas(HC, 'Cost (7d)'), meas(HC, 'Credits (7d)')) } },
      { type: 'clusteredColumnChart', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(HC, 'USAGE_HOUR')), Series: P(col(HC, 'WAREHOUSE_NAME')), Y: P(meas(HC, 'Credits (7d)')) } },
    ]),

  page('Pipeline Health', 'Pipeline Health', 'Dynamic-table refresh reliability',
    [dateSlicer, layerSlicer(DR), monthSlicer],
    [
      ...cards([[DR, 'Total Refreshes'], [DR, 'Success Rate %'], [DR, 'Failed Refreshes'],
                [DR, 'P95 Refresh Duration (s)'], [DR, 'Queue Share %'], [DR, 'Total Refresh Hours']]),
      withTip({ type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DR, 'Failure Rate %'), meas(DR, 'Target Lag Breach %')) } }, TIP_DAY),
      { type: 'clusteredColumnChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DR, 'REFRESH_STATE')), Series: P(col(DR, 'LAYER')), Y: P(meas(DR, 'Total Refreshes')) } },
      withTip({ type: 'clusteredBarChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(hier(DR, 'Pipeline', 'TABLE_NAME')),
             Y: P(meas(DR, 'Avg Refresh Duration (s)'), meas(DR, 'P95 Refresh Duration (s)')) } }, TIP_TABLE),
      withTip({ type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(DR, 'TABLE_NAME'), col(DR, 'REFRESH_STATE'), meas(DR, 'Total Refreshes'),
                       meas(DR, 'Target Lag Breaches'), meas(DR, 'Avg Lag Overage (min)'),
                       meas(DR, 'Rows per Refresh Second')) } }, TIP_TABLE),
    ]),

  page('Data Growth', 'Data Growth', 'Row counts and storage over time',
    [dateSlicer, layerSlicer(TS), monthSlicer],
    [
      ...cards([[TS, 'Rows (Latest)'], [TS, 'Storage GB (Latest)'], [TS, 'Row Growth 7D'],
                [TS, 'Row Growth 7D %'], [TS, 'Row Growth 30D %'], [TS, 'Avg Bytes per Row']]),
      withTip({ type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Series: P(col(TS, 'LAYER')), Y: P(meas(TS, 'Rows (Snapshot)')) } }, TIP_DAY),
      withTip({ type: 'lineChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Series: P(col(TS, 'LAYER')), Y: P(meas(TS, 'Storage GB (Snapshot)')) } }, TIP_DAY),
      withTip({ type: 'clusteredBarChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(hier(TS, 'Storage', 'TABLE_NAME')), Y: P(meas(TS, 'Row Growth 7D')) } }, TIP_TABLE),
      withTip({ type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(TS, 'LAYER'), col(TS, 'TABLE_NAME'), meas(TS, 'Rows (Latest)'),
                       meas(TS, 'Row Growth 7D'), meas(TS, 'Row Growth 7D %'), meas(TS, 'Storage GB (Latest)')) } }, TIP_TABLE),
    ]),

  page('Table Inventory', 'Table Inventory', 'Current state of every monitored table',
    [layerSlicer(CT), monthSlicer],
    [
      ...cards([[CT, 'Tables Monitored'], [CT, 'Dynamic Tables'], [CT, 'Empty Tables'],
                [CT, 'Stale Tables (30d)'], [CT, 'Avg Rows per Table'], [CT, 'Current Storage GB']]),
      { type: 'donutChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(CT, 'LAYER')), Y: P(meas(CT, 'Tables Monitored')) } },
      { type: 'clusteredColumnChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(CT, 'LAYER')), Series: P(col(CT, 'IS_DYNAMIC')), Y: P(meas(CT, 'Tables Monitored')) } },
      withTip({ type: 'tableEx', x: L, y: R2_Y, w: FULL, h: ROW_H,
        q: { Values: P(hier(CT, 'Inventory', 'LAYER'), col(CT, 'TABLE_NAME'), col(CT, 'IS_DYNAMIC'),
                       meas(CT, 'Current Rows'), meas(CT, 'Current Storage GB'),
                       col(CT, 'RETENTION_TIME'), col(CT, 'LAST_ALTERED')) } }, TIP_TABLE),
    ]),

  page('Warehouse Efficiency', 'Warehouse Efficiency', 'Where the compute actually goes',
    [dateSlicer, monthSlicer],
    [
      ...cards([[HC, 'Active Warehouses'], [HC, 'Utilisation %'], [HC, 'Off-Hours Credits %'],
                [HC, 'Warehouse Concentration %'], [HC, 'Avg Credits per Active Hour'], [HC, 'Peak Hourly Credits']]),
      { type: 'clusteredColumnChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(HC, 'USAGE_HOUR')), Series: P(col(HC, 'WAREHOUSE_NAME')), Y: P(meas(HC, 'Credits (7d)')) } },
      { type: 'clusteredBarChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(HC, 'WAREHOUSE_NAME')), Y: P(meas(HC, 'Active Hours'), meas(HC, 'Idle Hours')) } },
      { type: 'clusteredColumnChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Day of Week')), Y: P(meas(HC, 'Credits (7d)'), meas(DC, 'Estimated Cost')) } },
      { type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(HC, 'WAREHOUSE_NAME'), meas(HC, 'Credits (7d)'), meas(HC, 'Cost (7d)'),
                       meas(HC, 'Active Hours'), meas(HC, 'Idle Hours'), meas(HC, 'Utilisation %')) } },
    ]),

  page('Refresh Deep Dive', 'Refresh Deep Dive', 'How the pipeline spends its time',
    [dateSlicer, layerSlicer(DR), monthSlicer],
    [
      ...cards([[DR, 'Incremental Refresh %'], [DR, 'Full Refresh %'], [DR, 'Scheduled Refresh %'],
                [DR, 'Manual Refresh %'], [DR, 'Compile Share %'], [DR, 'Avg Rows per Refresh']]),
      { type: 'clusteredColumnChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DR, 'REFRESH_ACTION')), Series: P(col(DR, 'LAYER')), Y: P(meas(DR, 'Total Refreshes')) } },
      { type: 'donutChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DR, 'REFRESH_TRIGGER')), Y: P(meas(DR, 'Total Refreshes')) } },
      { type: 'lineChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')),
             Y: P(meas(DR, 'Avg Compilation (ms)'), meas(DR, 'Avg Execution (ms)'), meas(DR, 'Avg Queued (ms)')) } },
      { type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(DR, 'TABLE_NAME'), meas(DR, 'Total Refreshes'), meas(DR, 'Incremental Refresh %'),
                       meas(DR, 'Full Refresh %'), meas(DR, 'Avg Rows per Refresh'), meas(DR, 'Rows per Refresh Second')) } },
    ]),

  page('Freshness & SLA', 'Freshness & SLA', 'Target-lag compliance and failures',
    [dateSlicer, layerSlicer(DR), monthSlicer],
    [
      ...cards([[DR, 'Target Lag Breaches'], [DR, 'Target Lag Breach %'], [DR, 'Avg Lag Overage (min)'],
                [DR, 'Worst Lag Overage (min)'], [DR, 'Tables with Failures'], [DR, 'Failure Concentration %']]),
      { type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DR, 'Target Lag Breach %'), meas(DR, 'Failure Rate %')) } },
      { type: 'clusteredBarChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(hier(DR, 'Pipeline', 'TABLE_NAME')), Y: P(meas(DR, 'Target Lag Breaches')) } },
      { type: 'clusteredColumnChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DR, 'LAYER')), Y: P(meas(DR, 'Avg Lag Overage (min)'), meas(DR, 'Worst Lag Overage (min)')) } },
      { type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(DR, 'TABLE_NAME'), meas(DR, 'Target Lag Breaches'), meas(DR, 'Avg Lag Overage (min)'),
                       meas(DR, 'Failed Refreshes'), meas(DR, 'Distinct Errors')) } },
    ]),

  page('Executive Summary', 'Executive Summary', 'The whole platform on one page',
    [dateSlicer, monthSlicer],
    [
      ...cards([[DC, 'Estimated Cost'], [DC, 'Cost MTD'], [DC, 'Run Rate (30d) USD'],
                [DR, 'Success Rate %'], [TS, 'Rows (Latest)'], [CT, 'Tables Monitored']]),
      { type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DC, 'Estimated Cost'), meas(DC, 'Credits 7D Avg')) } },
      { type: 'clusteredColumnChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(hier(DT, 'Calendar', 'Month Name')),
             Y: P(meas(DC, 'Estimated Cost'), meas(DC, 'Weekend Cost')) } },
      { type: 'clusteredBarChart', x: L, y: R2_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(CT, 'LAYER')), Y: P(meas(CT, 'Current Rows'), meas(CT, 'Current Storage GB')) } },
      { type: 'tableEx', x: R, y: R2_Y, w: HALF, h: ROW_H,
        q: { Values: P(col(CT, 'LAYER'), meas(CT, 'Tables Monitored'), meas(TS, 'Row Growth 7D %'),
                       meas(DR, 'Success Rate %'), meas(DR, 'Target Lag Breach %'), meas(CT, 'Current Storage GB')) } },
    ]),

  // ---- drillthrough: right-click a table anywhere, land here ---------------
  {
    name: DRILL, hidden: true,
    pageBinding: { name: pid(DRILL), type: 'Drillthrough' },
    filterConfig: { filters: [{
      name: 'drillTableName',
      field: { Column: { Expression: { SourceRef: { Entity: CT } }, Property: 'TABLE_NAME' } },
      type: 'Drillthrough', howCreated: 'Drillthrough',
    }] },
    visuals: [
      ...headerBand('Table Detail', 'Drillthrough'),
      ...cards([[CT, 'Current Rows'], [CT, 'Current Storage GB'], [TS, 'Row Growth 7D %'],
                [DR, 'Total Refreshes'], [DR, 'Success Rate %'], [DR, 'Avg Refresh Duration (s)']]),
      { type: 'lineChart', x: L, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(TS, 'Rows (Snapshot)'), meas(TS, 'Storage GB (Snapshot)')) } },
      { type: 'lineChart', x: R, y: R1_Y, w: HALF, h: ROW_H,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DR, 'Avg Refresh Duration (s)'), meas(DR, 'Rows per Refresh Second')) } },
      { type: 'tableEx', x: L, y: R2_Y, w: FULL, h: ROW_H,
        q: { Values: P(col(DR, 'REFRESH_START_TIME'), col(DR, 'REFRESH_STATE'), col(DR, 'REFRESH_ACTION'),
                       col(DR, 'REFRESH_TRIGGER'), col(DR, 'REFRESH_DURATION_SEC'), col(DR, 'ROWS_INSERTED'),
                       col(DR, 'ROWS_DELETED'), col(DR, 'REFRESH_ERROR_MSG')) } },
    ],
  },

  // ---- tooltip pages -------------------------------------------------------
  {
    name: TIP_TABLE, hidden: true, w: 360, h: 260,
    pageBinding: { name: pid(TIP_TABLE), type: 'Tooltip' },
    visuals: [
      textbox(8, 6, 344, 24, [{ value: 'Table health', textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '11pt', color: BRAND.green } }]),
      { type: 'tableEx', x: 8, y: 34, w: 344, h: 218,
        q: { Values: P(meas(CT, 'Current Rows'), meas(CT, 'Current Storage GB'),
                       meas(DR, 'Total Refreshes'), meas(DR, 'Success Rate %'),
                       meas(DR, 'Avg Refresh Duration (s)'), meas(DR, 'Target Lag Breach %'),
                       meas(TS, 'Row Growth 7D %')) } },
    ],
  },
  {
    name: TIP_DAY, hidden: true, w: 360, h: 240,
    pageBinding: { name: pid(TIP_DAY), type: 'Tooltip' },
    visuals: [
      textbox(8, 6, 344, 24, [{ value: 'That day', textStyle: { fontFamily: 'Segoe UI Semibold', fontSize: '11pt', color: BRAND.green } }]),
      { type: 'tableEx', x: 8, y: 34, w: 344, h: 198,
        q: { Values: P(meas(DC, 'Estimated Cost'), meas(DC, 'Total Credits'),
                       meas(DR, 'Total Refreshes'), meas(DR, 'Failed Refreshes'),
                       meas(DR, 'Total Refresh Hours'), meas(TS, 'Rows (Snapshot)')) } },
    ],
  },
];
return has('tips') ? PAGES : PAGES.filter(pg => !pg.hidden);
};
