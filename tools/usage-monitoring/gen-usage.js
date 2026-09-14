// Definitions for the Usage_Monitoring model. One source of truth; the builder
// emits an identical project per environment, differing only in the parameters.
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
    label: 'DEV',
  },
  prod: {
    root: path.join(REPO, 'prod_reports'),
    server: 'ASCI-EDP_PRD.snowflakecomputing.com',
    warehouse: 'PROD_GOLD_WH',
    database: 'MONITORING_DB',
    schema: 'SNOWFLAKE',
    role: 'PROD_QLIK_READER_ROLE',
    label: 'PROD',
  },
};
const NAME = 'Usage_Monitoring';
const THEME_SRC = path.join(REPO, 'dev_reports', 'Snowflake_Arabian_Shield_Gold_model',
                            'Snowflake_Arabian_Shield_Gold_model.Report', 'StaticResources');

const guid = s => { const h = crypto.createHash('sha1').update('usage|' + s).digest('hex');
  return [h.slice(0,8),h.slice(8,12),'4'+h.slice(13,16),((parseInt(h[16],16)&3|8).toString(16))+h.slice(17,20),h.slice(20,32)].join('-'); };
const id20 = s => crypto.createHash('sha1').update('uid|' + s).digest('hex').slice(0, 20);

const S = 'string', I = 'int64', D = 'double', T = 'dateTime', B = 'boolean';
const FMT_INT = '#,0', FMT_2 = '#,0.00', FMT_PCT = '0.0%', FMT_DATE = 'yyyy-mm-dd';

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
    hierarchies: [['Pipeline', ['LAYER', 'SCHEMA_NAME', 'TABLE_NAME']]],
    measures: [
      ['Total Refreshes', 'COUNTROWS(DTS_Refresh)', FMT_INT, 'Every refresh attempt recorded.'],
      ['Successful Refreshes', 'CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] = "SUCCEEDED")', FMT_INT],
      ['Failed Refreshes', 'CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] IN {"FAILED", "UPSTREAM_FAILED"})', FMT_INT, 'Includes UPSTREAM_FAILED - a dependency failed, not this table.'],
      ['Cancelled Refreshes', 'CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] = "CANCELLED")', FMT_INT],
      ['Success Rate %', 'DIVIDE([Successful Refreshes], [Total Refreshes])', FMT_PCT],
      ['Failure Rate %', 'DIVIDE([Failed Refreshes], [Total Refreshes])', FMT_PCT],
      ['Tables Refreshed', 'DISTINCTCOUNT(DTS_Refresh[TABLE_NAME])', FMT_INT],
      ['Refresh Days', 'DISTINCTCOUNT(DTS_Refresh[REFRESH_DATE])', FMT_INT],
      ['Refreshes per Day', 'DIVIDE([Total Refreshes], [Refresh Days])', FMT_2],
      ['Avg Refresh Duration (s)', 'AVERAGE(DTS_Refresh[REFRESH_DURATION_SEC])', FMT_2],
      ['Median Refresh Duration (s)', 'MEDIANX(DTS_Refresh, DTS_Refresh[REFRESH_DURATION_SEC])', FMT_2, 'Half of refreshes finish faster than this.'],
      ['Max Refresh Duration (s)', 'MAX(DTS_Refresh[REFRESH_DURATION_SEC])', FMT_INT],
      ['P95 Refresh Duration (s)', 'PERCENTILEX.INC(DTS_Refresh, DTS_Refresh[REFRESH_DURATION_SEC], 0.95)', FMT_2, 'Tail latency - a better health signal than the average.'],
      ['Total Refresh Hours', 'DIVIDE(SUM(DTS_Refresh[REFRESH_DURATION_SEC]), 3600)', FMT_2, 'Compute time spent refreshing; drives cost.'],
      ['Avg Queued (ms)', 'AVERAGE(DTS_Refresh[QUEUED_MS])', FMT_2, 'Sustained queueing means the warehouse is undersized.'],
      ['Queue Share %', 'DIVIDE(SUM(DTS_Refresh[QUEUED_MS]), SUM(DTS_Refresh[QUEUED_MS]) + SUM(DTS_Refresh[EXECUTION_MS]) + SUM(DTS_Refresh[COMPILATION_MS]))', FMT_PCT, 'Portion of elapsed time spent waiting rather than working.'],
      ['Target Lag Breaches', 'CALCULATE([Total Refreshes], DTS_Refresh[EXCEEDED_TARGET_LAG] = TRUE())', FMT_INT, 'Refreshes that missed their freshness SLA.'],
      ['Target Lag Breach %', 'DIVIDE([Target Lag Breaches], [Total Refreshes])', FMT_PCT],
      ['Avg Lag Overage (min)', 'AVERAGE(DTS_Refresh[LAG_OVERAGE_MIN])', FMT_2, 'How far past target lag the breaches ran.'],
      ['Worst Lag Overage (min)', 'MAX(DTS_Refresh[LAG_OVERAGE_MIN])', FMT_2],
      ['Rows Inserted', 'SUM(DTS_Refresh[ROWS_INSERTED])', FMT_INT],
      ['Rows Deleted', 'SUM(DTS_Refresh[ROWS_DELETED])', FMT_INT],
      ['Net Rows Changed', '[Rows Inserted] - [Rows Deleted]', FMT_INT],
      ['Rows per Refresh Second', 'DIVIDE([Rows Inserted], SUM(DTS_Refresh[REFRESH_DURATION_SEC]))', FMT_2, 'Throughput. A falling value on steady volume means degradation.'],
      ['No-Data Refresh %', 'DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] = "NO_DATA"), [Total Refreshes])', FMT_PCT, 'Scheduled runs that found nothing to do - candidates for a longer target lag.'],
      ['Distinct Errors', 'CALCULATE(DISTINCTCOUNT(DTS_Refresh[REFRESH_ERROR_MSG]), NOT ISBLANK(DTS_Refresh[REFRESH_ERROR_MSG]))', FMT_INT],
      ['Slowest Table', 'CALCULATE(FIRSTNONBLANK(DTS_Refresh[TABLE_NAME], 1), TOPN(1, ALLSELECTED(DTS_Refresh[TABLE_NAME]), [Avg Refresh Duration (s)], DESC))', null, 'Name of the table with the highest average refresh duration in the current filter.'],
      ['Failures Last 7 Days', "CALCULATE([Failed Refreshes], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY))", FMT_INT],
      ['Tables with Failures', 'CALCULATE(DISTINCTCOUNT(DTS_Refresh[TABLE_NAME]), DTS_Refresh[REFRESH_STATE] IN {"FAILED", "UPSTREAM_FAILED"})', FMT_INT, 'How many distinct tables are failing - one broken table failing often is a very different problem from many tables failing once.'],
      ['Avg Compilation (ms)', 'AVERAGE(DTS_Refresh[COMPILATION_MS])', FMT_2],
      ['Avg Execution (ms)', 'AVERAGE(DTS_Refresh[EXECUTION_MS])', FMT_2],
      ['Compile Share %', 'DIVIDE(SUM(DTS_Refresh[COMPILATION_MS]), SUM(DTS_Refresh[COMPILATION_MS]) + SUM(DTS_Refresh[EXECUTION_MS]))', FMT_PCT, 'High compile share on short refreshes means planning costs more than the work.'],
      ['Incremental Refresh %', 'DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] = "INCREMENTAL"), [Total Refreshes])', FMT_PCT],
      ['Full Refresh %', 'DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] IN {"FULL", "REINITIALIZE"}), [Total Refreshes])', FMT_PCT, 'Full rebuilds are the expensive path; a rising share is worth chasing.'],
      ['Scheduled Refresh %', 'DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_TRIGGER] = "SCHEDULED"), [Total Refreshes])', FMT_PCT],
      ['Manual Refresh %', 'DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_TRIGGER] = "MANUAL"), [Total Refreshes])', FMT_PCT, 'Manual runs suggest someone is compensating for a schedule that does not fit.'],
      ['Avg Rows per Refresh', 'DIVIDE([Rows Inserted], [Total Refreshes])', FMT_INT],
      ['Refresh Hours per Table', 'DIVIDE([Total Refresh Hours], [Tables Refreshed])', FMT_2],
      ['Failure Concentration %', 'DIVIDE(MAXX(VALUES(DTS_Refresh[TABLE_NAME]), [Failed Refreshes]), [Failed Refreshes])', FMT_PCT, 'Share of all failures coming from the single worst table.'],
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
    hierarchies: [['Storage', ['LAYER', 'SCHEMA_NAME', 'TABLE_NAME']]],
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
      ['Rows 30D Ago', "CALCULATE([Rows (Latest)], DATEADD('Date'[Date], -30, DAY))", FMT_INT],
      ['Row Growth 30D %', 'DIVIDE([Rows (Latest)] - [Rows 30D Ago], [Rows 30D Ago])', FMT_PCT],
      ['Avg Daily Row Growth', 'DIVIDE([Row Growth 30D %] * [Rows 30D Ago], 30)', FMT_INT, 'Mean rows added per day over the last 30 days.'],
      ['Tables in Snapshot', 'DISTINCTCOUNT(Table_Snapshots[TABLE_NAME])', FMT_INT],
      ['Avg Bytes per Row', 'DIVIDE(CALCULATE(SUM(Table_Snapshots[BYTES]), LASTNONBLANK(\'Date\'[Date], [Rows (Snapshot)])), [Rows (Latest)])', FMT_2, 'Row width. A jump usually means a schema change or poor clustering.'],
    ['Fastest Growing Table', 'CALCULATE(FIRSTNONBLANK(Table_Snapshots[TABLE_NAME], 1), TOPN(1, ALLSELECTED(Table_Snapshots[TABLE_NAME]), [Row Growth 7D], DESC))', null],
      ['Tables Growing', 'COUNTROWS(FILTER(VALUES(Table_Snapshots[TABLE_NAME]), [Row Growth 7D] > 0))', FMT_INT],
      ['Tables Shrinking', 'COUNTROWS(FILTER(VALUES(Table_Snapshots[TABLE_NAME]), [Row Growth 7D] < 0))', FMT_INT, 'Shrinking tables are usually intentional pruning - or an upstream feed that broke.'],
      ['Tables Static 7D', 'COUNTROWS(FILTER(VALUES(Table_Snapshots[TABLE_NAME]), [Row Growth 7D] = 0))', FMT_INT],
      ['Daily Growth GB', "DIVIDE([Storage GB (Latest)] - [Storage GB 7D Ago], 7)", FMT_2],
      ['Projected GB in 90d', '[Storage GB (Latest)] + [Daily Growth GB] * 90', FMT_2, 'Straight-line projection from the last 7 days - a planning hint, not a forecast.'],
    ],
  },
  {
    name: 'Current_Tables', query: Q.Current_Tables,
    doc: 'Current state of every monitored table across BRONZE, SILVER and GOLD.',
    cols: [
      ['LAYER', S], ['DATABASE_NAME', S], ['SCHEMA_NAME', S], ['TABLE_NAME', S], ['IS_DYNAMIC', S],
      ['ROW_COUNT', I], ['BYTES', I], ['RETENTION_TIME', I], ['CREATED_AT', T], ['LAST_ALTERED', T], ['TABLE_COMMENT', S],
    ],
    hierarchies: [['Inventory', ['LAYER', 'SCHEMA_NAME', 'TABLE_NAME']]],
    measures: [
      ['Tables Monitored', 'COUNTROWS(Current_Tables)', FMT_INT],
      ['Current Rows', 'SUM(Current_Tables[ROW_COUNT])', FMT_INT],
      ['Current Storage GB', 'DIVIDE(SUM(Current_Tables[BYTES]), 1073741824)', FMT_2],
      ['Dynamic Tables', 'CALCULATE([Tables Monitored], Current_Tables[IS_DYNAMIC] = "YES")', FMT_INT],
      ['Static Tables', 'CALCULATE([Tables Monitored], Current_Tables[IS_DYNAMIC] = "NO")', FMT_INT],
      ['Dynamic Table %', 'DIVIDE([Dynamic Tables], [Tables Monitored])', FMT_PCT],
      ['Empty Tables', 'CALCULATE([Tables Monitored], Current_Tables[ROW_COUNT] = 0)', FMT_INT, 'Zero-row tables - either genuinely empty or a broken pipeline.'],
      ['Empty Table %', 'DIVIDE([Empty Tables], [Tables Monitored])', FMT_PCT],
      ['Avg Rows per Table', 'DIVIDE([Current Rows], [Tables Monitored])', FMT_INT],
      ['Largest Table Rows', 'MAX(Current_Tables[ROW_COUNT])', FMT_INT],
      ['Largest Table', 'CALCULATE(FIRSTNONBLANK(Current_Tables[TABLE_NAME], 1), TOPN(1, ALLSELECTED(Current_Tables[TABLE_NAME]), [Current Rows], DESC))', null, 'Name of the biggest table by row count in the current filter.'],
      ['Stale Tables (30d)', 'CALCULATE([Tables Monitored], FILTER(Current_Tables, Current_Tables[LAST_ALTERED] < TODAY() - 30))', FMT_INT, 'Not altered in 30 days - either stable reference data or a stalled feed.'],
      ['Avg Retention Days', 'AVERAGE(Current_Tables[RETENTION_TIME])', FMT_2],
      ['Median Rows per Table', 'MEDIANX(Current_Tables, Current_Tables[ROW_COUNT])', FMT_INT, 'With a 300M-row outlier present, the median describes the estate better than the mean.'],
      ['Storage Concentration %', 'DIVIDE(MAXX(VALUES(Current_Tables[TABLE_NAME]), [Current Storage GB]), [Current Storage GB])', FMT_PCT, 'Share of all storage held by the single largest table.'],
      ['Tables > 1M Rows', 'CALCULATE([Tables Monitored], FILTER(Current_Tables, Current_Tables[ROW_COUNT] > 1000000))', FMT_INT],
      ['Largest Table GB', 'DIVIDE(MAX(Current_Tables[BYTES]), 1073741824)', FMT_2],
      ['Newest Table Date', 'MAX(Current_Tables[CREATED_AT])', FMT_DATE],
      ['Last Change', 'MAX(Current_Tables[LAST_ALTERED])', FMT_DATE, 'Most recent write anywhere in the current filter - a staleness canary.'],
    ],
  },
  {
    name: 'Daily_Consumption', query: Q.Daily_Consumption,
    doc: 'Credits per day, account-wide.',
    cols: [
      ['USAGE_DATE', T, FMT_DATE], ['TOTAL_CREDITS', D], ['COMPUTE_CREDITS', D],
      ['CLOUD_SERVICES_CREDITS', D], ['WAREHOUSES_USED', I],
    ],
    // Credits only. The view's USD column is an inaccurate calculated rate, so it
    // is neither loaded nor surfaced - every metric here is in credits.
    measures: [
      ['Total Credits', 'SUM(Daily_Consumption[TOTAL_CREDITS])', FMT_2],
      ['Compute Credits', 'SUM(Daily_Consumption[COMPUTE_CREDITS])', FMT_2],
      ['Cloud Services Credits', 'SUM(Daily_Consumption[CLOUD_SERVICES_CREDITS])', FMT_2],
      ['Cloud Services %', 'DIVIDE([Cloud Services Credits], [Total Credits])', FMT_PCT, 'Snowflake bills cloud services only above 10% of compute; a high share is worth investigating.'],
      ['Avg Daily Credits', 'AVERAGE(Daily_Consumption[TOTAL_CREDITS])', FMT_2],
      ['Peak Daily Credits', 'MAX(Daily_Consumption[TOTAL_CREDITS])', FMT_2],
      ['Days Monitored', 'DISTINCTCOUNT(Daily_Consumption[USAGE_DATE])', FMT_INT],
      ['Credits Last 7 Days', "CALCULATE([Total Credits], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY))", FMT_2],
      ['Credits Prev 7 Days', "CALCULATE([Total Credits], DATESINPERIOD('Date'[Date], MAX('Date'[Date]) - 7, -7, DAY))", FMT_2],
      ['Credits WoW %', 'DIVIDE([Credits Last 7 Days] - [Credits Prev 7 Days], [Credits Prev 7 Days])', FMT_PCT],
      ['Credits MTD', "CALCULATE([Total Credits], DATESMTD('Date'[Date]))", FMT_2],
      ['Credits 7D Avg', "AVERAGEX(DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY), [Total Credits])", FMT_2, 'Rolling mean - smooths the weekday/weekend saw-tooth.'],
      ['Run Rate (30d) Credits', '[Avg Daily Credits] * 30', FMT_2, 'Projected monthly credits at the current daily average.'],
      ['Credits per Million Rows', 'DIVIDE([Total Credits], DIVIDE([Rows (Latest)], 1000000))', FMT_2, 'Unit economics: credits against data actually landed.'],
      ['Credits per Refresh Hour', 'DIVIDE([Total Credits], [Total Refresh Hours])', FMT_2, 'Credit burn per hour of dynamic-table refresh work.'],
      ['Credits Volatility', 'STDEVX.P(VALUES(Daily_Consumption[USAGE_DATE]), [Total Credits])', FMT_2, 'Day-to-day spread of daily credits. High volatility makes a run rate meaningless.'],
      ['Days Above Avg Credits', 'COUNTROWS(FILTER(VALUES(Daily_Consumption[USAGE_DATE]), [Total Credits] > [Avg Daily Credits]))', FMT_INT],
      ['Weekend Credits', "CALCULATE([Total Credits], 'Date'[Is Weekend] = TRUE())", FMT_2],
      ['Weekend Credits %', 'DIVIDE([Weekend Credits], [Total Credits])', FMT_PCT, 'Credits burned on days nobody is working - usually pure schedule cost.'],
      ['Highest Credit Day', "CALCULATE(FIRSTNONBLANK('Date'[Date], 1), TOPN(1, ALLSELECTED('Date'[Date]), [Total Credits], DESC))", FMT_DATE],
      ['Credits per GB Stored', 'DIVIDE([Total Credits], [Storage GB (Latest)])', FMT_2],
    ],
  },
  {
    name: 'Hourly_Consumption', query: Q.Hourly_Consumption,
    doc: 'Rolling 7-day hourly credit burn per warehouse.',
    cols: [
      ['WAREHOUSE_ID', I], ['WAREHOUSE_NAME', S], ['START_TIME', T], ['END_TIME', T],
      ['USAGE_DATE', T, FMT_DATE], ['USAGE_HOUR', I], ['CREDITS_USED', D],
      ['CREDITS_USED_COMPUTE', D], ['CREDITS_USED_CLOUD_SERVICES', D],
    ],
    measures: [
      ['Credits (7d)', 'SUM(Hourly_Consumption[CREDITS_USED])', FMT_2],
      ['Active Warehouses', 'DISTINCTCOUNT(Hourly_Consumption[WAREHOUSE_NAME])', FMT_INT],
      ['Peak Hourly Credits', 'MAX(Hourly_Consumption[CREDITS_USED])', FMT_2],
      ['Active Hours', 'CALCULATE(COUNTROWS(Hourly_Consumption), Hourly_Consumption[CREDITS_USED] > 0)', FMT_INT],
      ['Idle Hours', 'CALCULATE(COUNTROWS(Hourly_Consumption), Hourly_Consumption[CREDITS_USED] = 0)', FMT_INT],
      ['Avg Credits per Active Hour', 'DIVIDE([Credits (7d)], [Active Hours])', FMT_2],
      ['Busiest Hour', 'CALCULATE(FIRSTNONBLANK(Hourly_Consumption[USAGE_HOUR], 1), TOPN(1, ALLSELECTED(Hourly_Consumption[USAGE_HOUR]), [Credits (7d)], DESC))', FMT_INT, 'Hour of day with the highest credit burn.'],
      ['Utilisation %', 'DIVIDE([Active Hours], COUNTROWS(Hourly_Consumption))', FMT_PCT, 'Share of monitored hours where the warehouse did any work.'],
      ['Off-Hours Credits', 'CALCULATE([Credits (7d)], Hourly_Consumption[USAGE_HOUR] < 7 || Hourly_Consumption[USAGE_HOUR] > 19)', FMT_2],
      ['Off-Hours Credits %', 'DIVIDE([Off-Hours Credits], [Credits (7d)])', FMT_PCT, 'Burn outside 07:00-19:00. Fine for batch, worth questioning otherwise.'],
      ['Top Warehouse', 'CALCULATE(FIRSTNONBLANK(Hourly_Consumption[WAREHOUSE_NAME], 1), TOPN(1, ALLSELECTED(Hourly_Consumption[WAREHOUSE_NAME]), [Credits (7d)], DESC))', null],
      ['Warehouse Concentration %', 'DIVIDE(MAXX(VALUES(Hourly_Consumption[WAREHOUSE_NAME]), [Credits (7d)]), [Credits (7d)])', FMT_PCT, 'Share of credits burned by the single busiest warehouse.'],
      ['Busiest Day of Week', "CALCULATE(FIRSTNONBLANK('Date'[Day of Week], 1), TOPN(1, ALLSELECTED('Date'[Day of Week]), [Credits (7d)], DESC))", null],
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
  '    "Month Sort", YEAR([Date]) * 100 + MONTH([Date]),',
  '    "Day of Week", FORMAT([Date], "ddd"),',
  '    "Day of Week No", WEEKDAY([Date], 2),',
  '    "Is Weekend", WEEKDAY([Date], 2) > 5,',
  '    "Week Start", [Date] - WEEKDAY([Date], 2) + 1',
  ')',
];
// [name, type, formatString, sortByColumn]
const DATE_COLS = [
  ['Date', T, FMT_DATE], ['Year', I], ['Month', S],
  ['Month Name', S, null, 'Month Sort'], ['Month Sort', I],
  ['Day of Week', S, null, 'Day of Week No'], ['Day of Week No', I],
  ['Is Weekend', B], ['Week Start', T, FMT_DATE],
];
const DATE_HIERARCHIES = [['Calendar', ['Year', 'Month Name', 'Date']]];

const RELATIONSHIPS = [
  ['Date', 'Date', 'DTS_Refresh', 'REFRESH_DATE'],
  ['Date', 'Date', 'Table_Snapshots', 'SNAPSHOT_DATE'],
  ['Date', 'Date', 'Daily_Consumption', 'USAGE_DATE'],
  ['Date', 'Date', 'Hourly_Consumption', 'USAGE_DATE'],
];

const PARAMS = [
  ['SnowflakeServer', 'server', 'Snowflake account URL for this environment.'],
  ['SnowflakeWarehouse', 'warehouse', 'Warehouse used to run the monitoring queries.'],
  ['SnowflakeDatabase', 'database', 'Monitoring database. The native queries run inside it and name only the SNOWFLAKE schema.'],
  ['SnowflakeRole', 'role', 'Role assumed on connect.'],
];

module.exports = { REPO, ENVS, NAME, TABLES, DATE_DAX, DATE_COLS, DATE_HIERARCHIES,
                   RELATIONSHIPS, PARAMS, THEME_SRC, guid, id20 };
