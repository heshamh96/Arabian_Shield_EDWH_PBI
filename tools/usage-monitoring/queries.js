// Single source of truth for the Usage_Monitoring model's source queries.
// Used both to smoke-test against Snowflake and to generate the TMDL partitions.
// Queries are scoped to the connected database (MONITORING_DB), so they address
// objects as SCHEMA.OBJECT.

const REFRESH_COLS = `cast(REFRESH_START_TIME as date) as REFRESH_DATE,
       TABLE_NAME, SCHEMA_NAME, DATABASE_NAME, QUERY_ID, REFRESH_STATE, STATE_CODE,
       REFRESH_ERROR_MSG, REFRESH_START_TIME, REFRESH_END_TIME, REFRESH_DURATION_SEC,
       LAG_TILL_REFRESHED_MIN, TARGET_LAG_MIN, EXCEEDED_TARGET_LAG, LAG_OVERAGE_MIN,
       COMPILATION_MS, EXECUTION_MS, QUEUED_MS, ROWS_INSERTED, ROWS_DELETED,
       REFRESH_ACTION, REFRESH_TRIGGER, REFRESH_WAREHOUSE`;

const CURRENT_COLS = (layer) => `select '${layer}' as LAYER, "DATABASE" as DATABASE_NAME, "SCHEMA" as SCHEMA_NAME,
       "TABLE" as TABLE_NAME, IS_DYNAMIC, ROW_COUNT, BYTES, RETENTION_TIME,
       cast(CREATED_AT as timestamp_ntz) as CREATED_AT,
       cast(LAST_ALTERED as timestamp_ntz) as LAST_ALTERED,
       "COMMENT" as TABLE_COMMENT
from {DB}.SNOWFLAKE.VW_${layer}_TABLE_CURRENT_COUNT`;

module.exports = {
  // Dynamic-table refresh telemetry, both layers unioned with a LAYER tag.
  DTS_Refresh: `
select 'GOLD' as LAYER, ${REFRESH_COLS}
from {DB}.SNOWFLAKE.GOLD_DTS_REFRESH_LONG_TERM_HISTORY
union all
select 'SILVER' as LAYER, ${REFRESH_COLS}
from {DB}.SNOWFLAKE.SILVER_DTS_REFRESH_LONG_TERM_HISTORY`.trim(),

  // Daily row-count / storage snapshots per table. SCHEMA_NAME is the medallion layer.
  Table_Snapshots: `
select cast(SNAPSHOT_TIME as date) as SNAPSHOT_DATE, SNAPSHOT_TIME,
       DATABASE_NAME, SCHEMA_NAME as LAYER, SCHEMA_NAME, TABLE_NAME,
       IS_DYNAMIC, ROW_COUNT, BYTES, RETENTION_TIME,
       CREATED_AT, LAST_ALTERED, "COMMENT" as TABLE_COMMENT
from {DB}.SNOWFLAKE.TABLE_COUNT_DAILY_SNAPSHOTS`.trim(),

  // Current state of every monitored table, all three layers.
  Current_Tables: `
${CURRENT_COLS('BRONZE')}
union all
${CURRENT_COLS('SILVER')}
union all
${CURRENT_COLS('GOLD')}`.trim(),

  // Credits per day. The view's ESTIMATED_DAILY_COST_USD is a calculated column
  // with an inaccurate rate, so it is deliberately not selected - the model
  // speaks in credits only.
  Daily_Consumption: `
select USAGE_DATE, TOTAL_CREDITS, COMPUTE_CREDITS, CLOUD_SERVICES_CREDITS,
       WAREHOUSES_USED
from {DB}.SNOWFLAKE.VW_DAILY_CONSUMPTION_SUMMARY`.trim(),

  // Rolling 7-day hourly credit burn per warehouse. ESTIMATED_COST_USD is
  // likewise excluded - see Daily_Consumption above.
  Hourly_Consumption: `
select WAREHOUSE_ID, WAREHOUSE_NAME, START_TIME, END_TIME,
       cast(START_TIME as date) as USAGE_DATE, hour(START_TIME) as USAGE_HOUR,
       CREDITS_USED, CREDITS_USED_COMPUTE, CREDITS_USED_CLOUD_SERVICES
from {DB}.SNOWFLAKE.VW_VWH_HOURLY_CONSUMPTION_7D`.trim(),
};
