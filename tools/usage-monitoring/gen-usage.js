// Generates the Usage_Monitoring .pbip project for one environment.
// Dev and prod differ ONLY in the five connection parameters, so the model and
// report are byte-identical between them apart from expressions.tmdl.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..');
const Q = require('./queries.js');

const ENVS = {
  dev: {
    root: path.join(REPO, 'dev_reports'),
    server: 'ASCI-EDP.snowflakecomputing.com',
    warehouse: 'DEV_GOLD_WH',
    database: 'MONITORING_DB',
    schema: 'SNOWFLAKE',
    role: 'DEV_QLIK_READER_ROLE',
  },
  prod: {
    root: path.join(REPO, 'prod_reports'),
    server: 'ASCI-EDP_PRD.snowflakecomputing.com',
    warehouse: 'PROD_GOLD_WH',
    database: 'MONITORING_DB',
    schema: 'SNOWFLAKE',
    role: 'PROD_QLIK_READER_ROLE',
  },
};
const NAME = 'Usage_Monitoring';
const THEME_SRC = path.join(REPO, 'dev_reports', 'Snowflake_Arabian_Shield_Gold_model', 'Snowflake_Arabian_Shield_Gold_model.Report', 'StaticResources');

// Deterministic ids so regenerating produces no spurious diffs.
const guid = s => { const h = crypto.createHash('sha1').update('usage|' + s).digest('hex');
  return [h.slice(0,8),h.slice(8,12),'4'+h.slice(13,16),((parseInt(h[16],16)&3|8).toString(16))+h.slice(17,20),h.slice(20,32)].join('-'); };
const id20 = s => crypto.createHash('sha1').update('uid|' + s).digest('hex').slice(0, 20);

const S = 'string', I = 'int64', D = 'double', T = 'dateTime', B = 'boolean';
const FMT_INT = '#,0', FMT_2 = '#,0.00', FMT_PCT = '0.0%', FMT_USD = '\\$#,0.00', FMT_DATE = 'yyyy-mm-dd';

// ---------------------------------------------------------------- model ----
const TABLES = [
  {
    name: 'DTS_Refresh', query: Q.DTS_Refresh,
    doc: 'Dynamic-table refresh telemetry for the SILVER and GOLD layers, unioned.',
    cols: [
      ['REFRESH_DATE', T, FMT_DATE], ['LAYER', S], ['TABLE_NAME', S], ['SCHEMA_NAME', S], ['DATABASE_NAME', S],
      ['QUERY_ID', S], ['REFRESH_STATE', S], ['STATE_CODE', S], ['REFRESH_ERROR_MSG', S],
      ['REFRESH_START_TIME', T], ['REFRESH_END_TIME', T], ['REFRESH_DURATION_SEC', I],
      ['LAG_TILL_REFRESHED_MIN', D], ['TARGET_LAG_MIN', D], ['EXCEEDED_TARGET_LAG', B], ['LAG_OVERAGE_MIN', D],
      ['COMPILATION_MS', I], ['EXECUTION_MS', I], ['QUEUED_MS', I], ['ROWS_INSERTED', I], ['ROWS_DELETED', I],
      ['REFRESH_ACTION', S], ['REFRESH_TRIGGER', S], ['REFRESH_WAREHOUSE', S],
    ],
    measures: [
      ['Total Refreshes', 'COUNTROWS(DTS_Refresh)', FMT_INT, 'Every refresh attempt recorded.'],
      ['Successful Refreshes', 'CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] = "SUCCEEDED")', FMT_INT],
      ['Failed Refreshes', 'CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] IN {"FAILED", "UPSTREAM_FAILED"})', FMT_INT, 'Includes UPSTREAM_FAILED - a dependency failed, not this table.'],
      ['Cancelled Refreshes', 'CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] = "CANCELLED")', FMT_INT],
      ['Success Rate %', 'DIVIDE([Successful Refreshes], [Total Refreshes])', FMT_PCT],
      ['Failure Rate %', 'DIVIDE([Failed Refreshes], [Total Refreshes])', FMT_PCT],
      ['Tables Refreshed', 'DISTINCTCOUNT(DTS_Refresh[TABLE_NAME])', FMT_INT],
      ['Avg Refresh Duration (s)', 'AVERAGE(DTS_Refresh[REFRESH_DURATION_SEC])', FMT_2],
      ['Max Refresh Duration (s)', 'MAX(DTS_Refresh[REFRESH_DURATION_SEC])', FMT_INT],
      ['P95 Refresh Duration (s)', 'PERCENTILEX.INC(DTS_Refresh, DTS_Refresh[REFRESH_DURATION_SEC], 0.95)', FMT_2, 'Tail latency - a better health signal than the average.'],
      ['Total Refresh Hours', 'DIVIDE(SUM(DTS_Refresh[REFRESH_DURATION_SEC]), 3600)', FMT_2, 'Compute time spent refreshing; drives cost.'],
      ['Avg Queued (ms)', 'AVERAGE(DTS_Refresh[QUEUED_MS])', FMT_2, 'Sustained queueing means the warehouse is undersized.'],
      ['Target Lag Breaches', 'CALCULATE([Total Refreshes], DTS_Refresh[EXCEEDED_TARGET_LAG] = TRUE())', FMT_INT, 'Refreshes that missed their freshness SLA.'],
      ['Target Lag Breach %', 'DIVIDE([Target Lag Breaches], [Total Refreshes])', FMT_PCT],
      ['Avg Lag Overage (min)', 'AVERAGE(DTS_Refresh[LAG_OVERAGE_MIN])', FMT_2, 'How far past target lag the breaches ran.'],
      ['Rows Inserted', 'SUM(DTS_Refresh[ROWS_INSERTED])', FMT_INT],
      ['Rows Deleted', 'SUM(DTS_Refresh[ROWS_DELETED])', FMT_INT],
      ['No-Data Refresh %', 'DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] = "NO_DATA"), [Total Refreshes])', FMT_PCT, 'Scheduled runs that found nothing to do - candidates for a longer target lag.'],
    ],
  },
  {
    name: 'Table_Snapshots', query: Q.Table_Snapshots,
    doc: 'Daily row-count and storage snapshot per table. Semi-additive: sum across tables, not across days.',
    cols: [
      ['SNAPSHOT_DATE', T, FMT_DATE], ['SNAPSHOT_TIME', T], ['DATABASE_NAME', S], ['LAYER', S], ['SCHEMA_NAME', S],
      ['TABLE_NAME', S], ['IS_DYNAMIC', S], ['ROW_COUNT', I], ['BYTES', I], ['RETENTION_TIME', I],
      ['CREATED_AT', T], ['LAST_ALTERED', T], ['TABLE_COMMENT', S],
    ],
    measures: [
      ['Rows (Snapshot)', 'SUM(Table_Snapshots[ROW_COUNT])', FMT_INT, 'Only meaningful with a single date in filter context.'],
      ['Storage GB (Snapshot)', 'DIVIDE(SUM(Table_Snapshots[BYTES]), 1073741824)', FMT_2],
      ['Rows (Latest)', "CALCULATE([Rows (Snapshot)], LASTNONBLANK('Date'[Date], [Rows (Snapshot)]))", FMT_INT, 'Semi-additive: takes the most recent snapshot rather than summing every day.'],
      ['Storage GB (Latest)', "CALCULATE([Storage GB (Snapshot)], LASTNONBLANK('Date'[Date], [Rows (Snapshot)]))", FMT_2],
      ['Rows 7D Ago', "CALCULATE([Rows (Latest)], DATEADD('Date'[Date], -7, DAY))", FMT_INT],
      ['Row Growth 7D', '[Rows (Latest)] - [Rows 7D Ago]', FMT_INT],
      ['Row Growth 7D %', 'DIVIDE([Row Growth 7D], [Rows 7D Ago])', FMT_PCT],
      ['Storage GB 7D Ago', "CALCULATE([Storage GB (Latest)], DATEADD('Date'[Date], -7, DAY))", FMT_2],
      ['Storage Growth 7D %', 'DIVIDE([Storage GB (Latest)] - [Storage GB 7D Ago], [Storage GB 7D Ago])', FMT_PCT],
      ['Tables in Snapshot', 'DISTINCTCOUNT(Table_Snapshots[TABLE_NAME])', FMT_INT],
    ],
  },
  {
    name: 'Current_Tables', query: Q.Current_Tables,
    doc: 'Current state of every monitored table across BRONZE, SILVER and GOLD.',
    cols: [
      ['LAYER', S], ['DATABASE_NAME', S], ['SCHEMA_NAME', S], ['TABLE_NAME', S], ['IS_DYNAMIC', S],
      ['ROW_COUNT', I], ['BYTES', I], ['RETENTION_TIME', I], ['CREATED_AT', T], ['LAST_ALTERED', T], ['TABLE_COMMENT', S],
    ],
    measures: [
      ['Tables Monitored', 'COUNTROWS(Current_Tables)', FMT_INT],
      ['Current Rows', 'SUM(Current_Tables[ROW_COUNT])', FMT_INT],
      ['Current Storage GB', 'DIVIDE(SUM(Current_Tables[BYTES]), 1073741824)', FMT_2],
      ['Dynamic Tables', 'CALCULATE([Tables Monitored], Current_Tables[IS_DYNAMIC] = "YES")', FMT_INT],
      ['Static Tables', 'CALCULATE([Tables Monitored], Current_Tables[IS_DYNAMIC] = "NO")', FMT_INT],
      ['Dynamic Table %', 'DIVIDE([Dynamic Tables], [Tables Monitored])', FMT_PCT],
      ['Empty Tables', 'CALCULATE([Tables Monitored], Current_Tables[ROW_COUNT] = 0)', FMT_INT, 'Zero-row tables - either genuinely empty or a broken pipeline.'],
      ['Avg Rows per Table', 'DIVIDE([Current Rows], [Tables Monitored])', FMT_INT],
    ],
  },
  {
    name: 'Daily_Consumption', query: Q.Daily_Consumption,
    doc: 'Credits and estimated cost per day, account-wide.',
    cols: [
      ['USAGE_DATE', T, FMT_DATE], ['TOTAL_CREDITS', D], ['COMPUTE_CREDITS', D],
      ['CLOUD_SERVICES_CREDITS', D], ['WAREHOUSES_USED', I], ['ESTIMATED_DAILY_COST_USD', D],
    ],
    measures: [
      ['Total Credits', 'SUM(Daily_Consumption[TOTAL_CREDITS])', FMT_2],
      ['Compute Credits', 'SUM(Daily_Consumption[COMPUTE_CREDITS])', FMT_2],
      ['Cloud Services Credits', 'SUM(Daily_Consumption[CLOUD_SERVICES_CREDITS])', FMT_2],
      ['Cloud Services %', 'DIVIDE([Cloud Services Credits], [Total Credits])', FMT_PCT, 'Snowflake bills cloud services only above 10% of compute; a high share is worth investigating.'],
      ['Estimated Cost', 'SUM(Daily_Consumption[ESTIMATED_DAILY_COST_USD])', FMT_USD],
      ['Avg Daily Cost', 'AVERAGE(Daily_Consumption[ESTIMATED_DAILY_COST_USD])', FMT_USD],
      ['Peak Daily Cost', 'MAX(Daily_Consumption[ESTIMATED_DAILY_COST_USD])', FMT_USD],
      ['Days Monitored', 'DISTINCTCOUNT(Daily_Consumption[USAGE_DATE])', FMT_INT],
      ['Cost Last 7 Days', "CALCULATE([Estimated Cost], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY))", FMT_USD],
      ['Cost Prev 7 Days', "CALCULATE([Estimated Cost], DATESINPERIOD('Date'[Date], MAX('Date'[Date]) - 7, -7, DAY))", FMT_USD],
      ['Cost WoW %', 'DIVIDE([Cost Last 7 Days] - [Cost Prev 7 Days], [Cost Prev 7 Days])', FMT_PCT],
      ['Run Rate (30d) USD', '[Avg Daily Cost] * 30', FMT_USD, 'Projected monthly spend at the current daily average.'],
      ['Cost per Million Rows', 'DIVIDE([Estimated Cost], DIVIDE([Rows (Latest)], 1000000))', FMT_USD, 'Unit economics: spend against data actually landed.'],
    ],
  },
  {
    name: 'Hourly_Consumption', query: Q.Hourly_Consumption,
    doc: 'Rolling 7-day hourly credit burn per warehouse.',
    cols: [
      ['WAREHOUSE_ID', I], ['WAREHOUSE_NAME', S], ['START_TIME', T], ['END_TIME', T],
      ['USAGE_DATE', T, FMT_DATE], ['USAGE_HOUR', I], ['CREDITS_USED', D],
      ['CREDITS_USED_COMPUTE', D], ['CREDITS_USED_CLOUD_SERVICES', D], ['ESTIMATED_COST_USD', D],
    ],
    measures: [
      ['Credits (7d)', 'SUM(Hourly_Consumption[CREDITS_USED])', FMT_2],
      ['Cost (7d)', 'SUM(Hourly_Consumption[ESTIMATED_COST_USD])', FMT_USD],
      ['Active Warehouses', 'DISTINCTCOUNT(Hourly_Consumption[WAREHOUSE_NAME])', FMT_INT],
      ['Peak Hourly Credits', 'MAX(Hourly_Consumption[CREDITS_USED])', FMT_2],
      ['Active Hours', 'CALCULATE(COUNTROWS(Hourly_Consumption), Hourly_Consumption[CREDITS_USED] > 0)', FMT_INT],
      ['Avg Credits per Active Hour', 'DIVIDE([Credits (7d)], [Active Hours])', FMT_2],
    ],
  },
];

// Date dimension, derived from the facts so it always spans the loaded data.
const DATE_DAX = [
  'VAR AllDates =',
  '    DISTINCT(',
  '        UNION(',
  '            SELECTCOLUMNS(Daily_Consumption, "TheDate", Daily_Consumption[USAGE_DATE]),',
  '            SELECTCOLUMNS(Table_Snapshots, "TheDate", Table_Snapshots[SNAPSHOT_DATE]),',
  '            SELECTCOLUMNS(DTS_Refresh, "TheDate", DTS_Refresh[REFRESH_DATE]),',
  '            SELECTCOLUMNS(Hourly_Consumption, "TheDate", Hourly_Consumption[USAGE_DATE])',
  '        )',
  '    )',
  'VAR MinDate = MINX(AllDates, [TheDate])',
  'VAR MaxDate = MAXX(AllDates, [TheDate])',
  'RETURN',
  'ADDCOLUMNS(',
  '    CALENDAR(MinDate, MaxDate),',
  '    "Year", YEAR([Date]),',
  '    "Month", FORMAT([Date], "yyyy-MM"),',
  '    "Month Name", FORMAT([Date], "MMM yyyy"),',
  '    "Day of Week", FORMAT([Date], "ddd"),',
  '    "Day of Week No", WEEKDAY([Date], 2),',
  '    "Is Weekend", WEEKDAY([Date], 2) > 5,',
  '    "Week Start", [Date] - WEEKDAY([Date], 2) + 1',
  ')',
];
const DATE_COLS = [
  ['Date', T, FMT_DATE], ['Year', I], ['Month', S], ['Month Name', S],
  ['Day of Week', S], ['Day of Week No', I], ['Is Weekend', B], ['Week Start', T, FMT_DATE],
];

const RELATIONSHIPS = [
  ['Date', 'Date', 'DTS_Refresh', 'REFRESH_DATE'],
  ['Date', 'Date', 'Table_Snapshots', 'SNAPSHOT_DATE'],
  ['Date', 'Date', 'Daily_Consumption', 'USAGE_DATE'],
  ['Date', 'Date', 'Hourly_Consumption', 'USAGE_DATE'],
];

const PARAMS = [
  ['SnowflakeServer', 'server', 'Snowflake account URL for this environment.'],
  ['SnowflakeWarehouse', 'warehouse', 'Warehouse used to run the monitoring queries.'],
  ['SnowflakeDatabase', 'database', 'Monitoring database. Change here to repoint the whole model.'],
  ['SnowflakeSchema', 'schema', 'Schema holding the telemetry views.'],
  ['SnowflakeRole', 'role', 'Role assumed on connect.'],
];

module.exports = { REPO, ENVS, NAME, TABLES, DATE_DAX, DATE_COLS, RELATIONSHIPS, PARAMS, THEME_SRC, guid, id20 };
