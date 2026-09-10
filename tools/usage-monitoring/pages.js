// Report page + visual definitions for Usage_Monitoring.
// Page canvas is 1280x720. Layout grid: 12px margin, 10px gutter.
//   row 1 (cards)  y=12  h=88
//   row 2 (charts) y=110 h=290
//   row 3 (charts) y=410 h=298

const col = (entity, property, as) => ({
  field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: property } },
  queryRef: `${entity}.${property}`,
  nativeQueryRef: as || property,
});
const meas = (entity, name) => ({
  field: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: name } },
  queryRef: `${entity}.${name}`,
  nativeQueryRef: name,
});
const P = (...f) => ({ projections: f });

// entity shorthands
const DC = 'Daily_Consumption', HC = 'Hourly_Consumption', DR = 'DTS_Refresh',
      TS = 'Table_Snapshots', CT = 'Current_Tables', DT = 'Date';

// six cards across row 1
const cards = (items) => items.map((m, i) => ({
  type: 'cardVisual', x: 12 + i * 211, y: 12, w: 201, h: 88,
  q: { Values: P(meas(m[0], m[1])) },
}));

const L = 12, R = 650, WHALF = 618, W2 = 290, H3 = 298;

module.exports = [
  {
    name: 'Overview',
    visuals: [
      ...cards([[DC, 'Estimated Cost'], [DC, 'Total Credits'], [CT, 'Tables Monitored'],
                [TS, 'Rows (Latest)'], [DR, 'Success Rate %'], [DR, 'Target Lag Breach %']]),
      { type: 'lineChart', x: L, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DC, 'Estimated Cost')) } },
      { type: 'clusteredColumnChart', x: R, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DR, 'LAYER')), Y: P(meas(DR, 'Total Refreshes'), meas(DR, 'Failed Refreshes')) } },
      { type: 'clusteredBarChart', x: L, y: 410, w: WHALF, h: H3,
        q: { Category: P(col(CT, 'LAYER')), Y: P(meas(CT, 'Current Rows'), meas(CT, 'Current Storage GB')) } },
      { type: 'tableEx', x: R, y: 410, w: WHALF, h: H3,
        q: { Values: P(col(CT, 'LAYER'), meas(CT, 'Tables Monitored'), meas(CT, 'Dynamic Tables'),
                       meas(CT, 'Empty Tables'), meas(CT, 'Current Storage GB')) } },
    ],
  },
  {
    name: 'Cost & Consumption',
    visuals: [
      ...cards([[DC, 'Estimated Cost'], [DC, 'Avg Daily Cost'], [DC, 'Peak Daily Cost'],
                [DC, 'Run Rate (30d) USD'], [DC, 'Cost WoW %'], [DC, 'Cloud Services %']]),
      { type: 'lineChart', x: L, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DC, 'Total Credits'), meas(DC, 'Compute Credits'), meas(DC, 'Cloud Services Credits')) } },
      { type: 'clusteredColumnChart', x: R, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DT, 'Month')), Y: P(meas(DC, 'Estimated Cost')) } },
      { type: 'clusteredBarChart', x: L, y: 410, w: WHALF, h: H3,
        q: { Category: P(col(HC, 'WAREHOUSE_NAME')), Y: P(meas(HC, 'Cost (7d)'), meas(HC, 'Credits (7d)')) } },
      { type: 'clusteredColumnChart', x: R, y: 410, w: WHALF, h: H3,
        q: { Category: P(col(HC, 'USAGE_HOUR')), Y: P(meas(HC, 'Credits (7d)')) } },
    ],
  },
  {
    name: 'Pipeline Health',
    visuals: [
      ...cards([[DR, 'Total Refreshes'], [DR, 'Success Rate %'], [DR, 'Failed Refreshes'],
                [DR, 'Avg Refresh Duration (s)'], [DR, 'P95 Refresh Duration (s)'], [DR, 'Total Refresh Hours']]),
      { type: 'lineChart', x: L, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DT, 'Date')), Y: P(meas(DR, 'Failure Rate %'), meas(DR, 'Target Lag Breach %')) } },
      { type: 'clusteredColumnChart', x: R, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DR, 'REFRESH_STATE')), Series: P(col(DR, 'LAYER')), Y: P(meas(DR, 'Total Refreshes')) } },
      { type: 'clusteredBarChart', x: L, y: 410, w: WHALF, h: H3,
        q: { Category: P(col(DR, 'TABLE_NAME')), Y: P(meas(DR, 'Avg Refresh Duration (s)'), meas(DR, 'P95 Refresh Duration (s)')) } },
      { type: 'tableEx', x: R, y: 410, w: WHALF, h: H3,
        q: { Values: P(col(DR, 'TABLE_NAME'), col(DR, 'REFRESH_STATE'), meas(DR, 'Total Refreshes'),
                       meas(DR, 'Target Lag Breaches'), meas(DR, 'Avg Lag Overage (min)'), meas(DR, 'Avg Queued (ms)')) } },
    ],
  },
  {
    name: 'Data Growth',
    visuals: [
      ...cards([[TS, 'Rows (Latest)'], [TS, 'Storage GB (Latest)'], [TS, 'Row Growth 7D'],
                [TS, 'Row Growth 7D %'], [TS, 'Storage Growth 7D %'], [TS, 'Tables in Snapshot']]),
      { type: 'lineChart', x: L, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DT, 'Date')), Series: P(col(TS, 'LAYER')), Y: P(meas(TS, 'Rows (Snapshot)')) } },
      { type: 'lineChart', x: R, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(DT, 'Date')), Series: P(col(TS, 'LAYER')), Y: P(meas(TS, 'Storage GB (Snapshot)')) } },
      { type: 'clusteredBarChart', x: L, y: 410, w: WHALF, h: H3,
        q: { Category: P(col(TS, 'TABLE_NAME')), Y: P(meas(TS, 'Row Growth 7D')) } },
      { type: 'tableEx', x: R, y: 410, w: WHALF, h: H3,
        q: { Values: P(col(TS, 'LAYER'), col(TS, 'TABLE_NAME'), meas(TS, 'Rows (Latest)'),
                       meas(TS, 'Row Growth 7D'), meas(TS, 'Row Growth 7D %'), meas(TS, 'Storage GB (Latest)')) } },
    ],
  },
  {
    name: 'Table Inventory',
    visuals: [
      ...cards([[CT, 'Tables Monitored'], [CT, 'Dynamic Tables'], [CT, 'Static Tables'],
                [CT, 'Empty Tables'], [CT, 'Avg Rows per Table'], [CT, 'Current Storage GB']]),
      { type: 'pieChart', x: L, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(CT, 'LAYER')), Y: P(meas(CT, 'Tables Monitored')) } },
      { type: 'clusteredColumnChart', x: R, y: 110, w: WHALF, h: W2,
        q: { Category: P(col(CT, 'LAYER')), Series: P(col(CT, 'IS_DYNAMIC')), Y: P(meas(CT, 'Tables Monitored')) } },
      { type: 'tableEx', x: L, y: 410, w: 1256, h: H3,
        q: { Values: P(col(CT, 'LAYER'), col(CT, 'TABLE_NAME'), col(CT, 'IS_DYNAMIC'),
                       meas(CT, 'Current Rows'), meas(CT, 'Current Storage GB'),
                       col(CT, 'RETENTION_TIME'), col(CT, 'LAST_ALTERED')) } },
    ],
  },
];
