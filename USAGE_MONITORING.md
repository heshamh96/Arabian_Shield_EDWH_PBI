# Usage_Monitoring

A Snowflake platform-telemetry report over `MONITORING_DB`, built once and
shipped to both environments. The two copies are byte-identical apart from
`expressions.tmdl`:

| | dev_reports | prod_reports |
|---|---|---|
| Server | `ASCI-EDP.snowflakecomputing.com` | `ASCI-EDP_PRD.snowflakecomputing.com` |
| Warehouse | `DEV_GOLD_WH` | `PROD_GOLD_WH` |
| Role | `DEV_QLIK_READER_ROLE` | `PROD_QLIK_READER_ROLE` |
| Database | `MONITORING_DB` | `MONITORING_DB` |
| Account | `ZN91934` | `TG52301` |

Storage mode is **Import**, not DirectQuery. The whole model is well under a
million rows, and Import buys full DAX, time intelligence and instant visuals.
That is the opposite call from the GOLD model next door, where a 305M-row table
forced DirectQuery.

## Known gaps in the source data

These are properties of the source, not of the report. Visuals bound to them
render empty until the platform team populates them.

| Source | dev | prod | Effect |
|---|---|---|---|
| `GOLD_DTS_REFRESH_LONG_TERM_HISTORY` | 3,689 rows | **0** | Pipeline Health shows SILVER only in prod |
| `VW_GOLD_TABLE_CURRENT/HISTORY_COUNT` | 31 / 2,402 | **0 / 0** | No GOLD layer in prod inventory or growth |
| `*_DTS_REFRESH_SHORT_TERM_HISTORY` | **0** | **0** | Not used by the model at all |
| `TALEND.TALEND_LOGS` / `TALEND_STATISTICS` | **0** | **0** | No Talend analytics possible yet |
| `CDC` schema | no objects | no objects | No CDC analytics possible yet |

`ARABIANSHIELD_PROD` has only BRONZE and SILVER today - there is no GOLD schema -
which is why prod GOLD telemetry is empty rather than broken.

`SNOWFLAKE.ACCOUNT_USAGE` is **not** granted to either reader role, so richer
telemetry (query history, login history, storage growth) is out of reach unless
the platform team exposes it as another view in `MONITORING_DB`.

## Tables

| Table | Source | Rows (dev / prod) |
|---|---|---|
| `DTS_Refresh` | GOLD + SILVER refresh history, unioned with a `LAYER` tag | 30,344 / 372,284 |
| `Table_Snapshots` | `TABLE_COUNT_DAILY_SNAPSHOTS` | 46,537 / 19,179 |
| `Current_Tables` | 3 layer `*_CURRENT_COUNT` views, unioned | 607 / 519 |
| `Daily_Consumption` | `VW_DAILY_CONSUMPTION_SUMMARY` | 121 / 45 |
| `Hourly_Consumption` | `VW_VWH_HOURLY_CONSUMPTION_7D` | 69 / 349 |
| `Date` | DAX calculated, spans whatever the facts contain | - |

`Date` is a single conformed dimension joined 1-to-many to all four dated facts,
so one date slicer drives every page.

## Pages

- **Overview** - 10 visuals
- **Cost & Consumption** - 10 visuals
- **Pipeline Health** - 10 visuals
- **Data Growth** - 10 visuals
- **Table Inventory** - 9 visuals

## Measures

### `DTS_Refresh`

| Measure | DAX | Notes |
|---|---|---|
| **Total Refreshes** | `COUNTROWS(DTS_Refresh)` | Every refresh attempt recorded. |
| **Successful Refreshes** | `CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] = "SUCCEEDED")` |  |
| **Failed Refreshes** | `CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] IN {"FAILED", "UPSTREAM_FAILED"})` | Includes UPSTREAM_FAILED - a dependency failed, not this table. |
| **Cancelled Refreshes** | `CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_STATE] = "CANCELLED")` |  |
| **Success Rate %** | `DIVIDE([Successful Refreshes], [Total Refreshes])` |  |
| **Failure Rate %** | `DIVIDE([Failed Refreshes], [Total Refreshes])` |  |
| **Tables Refreshed** | `DISTINCTCOUNT(DTS_Refresh[TABLE_NAME])` |  |
| **Avg Refresh Duration (s)** | `AVERAGE(DTS_Refresh[REFRESH_DURATION_SEC])` |  |
| **Max Refresh Duration (s)** | `MAX(DTS_Refresh[REFRESH_DURATION_SEC])` |  |
| **P95 Refresh Duration (s)** | `PERCENTILEX.INC(DTS_Refresh, DTS_Refresh[REFRESH_DURATION_SEC], 0.95)` | Tail latency - a better health signal than the average. |
| **Total Refresh Hours** | `DIVIDE(SUM(DTS_Refresh[REFRESH_DURATION_SEC]), 3600)` | Compute time spent refreshing; drives cost. |
| **Avg Queued (ms)** | `AVERAGE(DTS_Refresh[QUEUED_MS])` | Sustained queueing means the warehouse is undersized. |
| **Target Lag Breaches** | `CALCULATE([Total Refreshes], DTS_Refresh[EXCEEDED_TARGET_LAG] = TRUE())` | Refreshes that missed their freshness SLA. |
| **Target Lag Breach %** | `DIVIDE([Target Lag Breaches], [Total Refreshes])` |  |
| **Avg Lag Overage (min)** | `AVERAGE(DTS_Refresh[LAG_OVERAGE_MIN])` | How far past target lag the breaches ran. |
| **Rows Inserted** | `SUM(DTS_Refresh[ROWS_INSERTED])` |  |
| **Rows Deleted** | `SUM(DTS_Refresh[ROWS_DELETED])` |  |
| **No-Data Refresh %** | `DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] = "NO_DATA"), [Total Refreshes])` | Scheduled runs that found nothing to do - candidates for a longer target lag. |

### `Table_Snapshots`

| Measure | DAX | Notes |
|---|---|---|
| **Rows (Snapshot)** | `SUM(Table_Snapshots[ROW_COUNT])` | Only meaningful with a single date in filter context. |
| **Storage GB (Snapshot)** | `DIVIDE(SUM(Table_Snapshots[BYTES]), 1073741824)` |  |
| **Rows (Latest)** | `CALCULATE([Rows (Snapshot)], LASTNONBLANK('Date'[Date], [Rows (Snapshot)]))` | Semi-additive: takes the most recent snapshot rather than summing every day. |
| **Storage GB (Latest)** | `CALCULATE([Storage GB (Snapshot)], LASTNONBLANK('Date'[Date], [Rows (Snapshot)]))` |  |
| **Rows 7D Ago** | `CALCULATE([Rows (Latest)], DATEADD('Date'[Date], -7, DAY))` |  |
| **Row Growth 7D** | `[Rows (Latest)] - [Rows 7D Ago]` |  |
| **Row Growth 7D %** | `DIVIDE([Row Growth 7D], [Rows 7D Ago])` |  |
| **Storage GB 7D Ago** | `CALCULATE([Storage GB (Latest)], DATEADD('Date'[Date], -7, DAY))` |  |
| **Storage Growth 7D %** | `DIVIDE([Storage GB (Latest)] - [Storage GB 7D Ago], [Storage GB 7D Ago])` |  |
| **Tables in Snapshot** | `DISTINCTCOUNT(Table_Snapshots[TABLE_NAME])` |  |

### `Current_Tables`

| Measure | DAX | Notes |
|---|---|---|
| **Tables Monitored** | `COUNTROWS(Current_Tables)` |  |
| **Current Rows** | `SUM(Current_Tables[ROW_COUNT])` |  |
| **Current Storage GB** | `DIVIDE(SUM(Current_Tables[BYTES]), 1073741824)` |  |
| **Dynamic Tables** | `CALCULATE([Tables Monitored], Current_Tables[IS_DYNAMIC] = "YES")` |  |
| **Static Tables** | `CALCULATE([Tables Monitored], Current_Tables[IS_DYNAMIC] = "NO")` |  |
| **Dynamic Table %** | `DIVIDE([Dynamic Tables], [Tables Monitored])` |  |
| **Empty Tables** | `CALCULATE([Tables Monitored], Current_Tables[ROW_COUNT] = 0)` | Zero-row tables - either genuinely empty or a broken pipeline. |
| **Avg Rows per Table** | `DIVIDE([Current Rows], [Tables Monitored])` |  |

### `Daily_Consumption`

| Measure | DAX | Notes |
|---|---|---|
| **Total Credits** | `SUM(Daily_Consumption[TOTAL_CREDITS])` |  |
| **Compute Credits** | `SUM(Daily_Consumption[COMPUTE_CREDITS])` |  |
| **Cloud Services Credits** | `SUM(Daily_Consumption[CLOUD_SERVICES_CREDITS])` |  |
| **Cloud Services %** | `DIVIDE([Cloud Services Credits], [Total Credits])` | Snowflake bills cloud services only above 10% of compute; a high share is worth investigating. |
| **Estimated Cost** | `SUM(Daily_Consumption[ESTIMATED_DAILY_COST_USD])` |  |
| **Avg Daily Cost** | `AVERAGE(Daily_Consumption[ESTIMATED_DAILY_COST_USD])` |  |
| **Peak Daily Cost** | `MAX(Daily_Consumption[ESTIMATED_DAILY_COST_USD])` |  |
| **Days Monitored** | `DISTINCTCOUNT(Daily_Consumption[USAGE_DATE])` |  |
| **Cost Last 7 Days** | `CALCULATE([Estimated Cost], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY))` |  |
| **Cost Prev 7 Days** | `CALCULATE([Estimated Cost], DATESINPERIOD('Date'[Date], MAX('Date'[Date]) - 7, -7, DAY))` |  |
| **Cost WoW %** | `DIVIDE([Cost Last 7 Days] - [Cost Prev 7 Days], [Cost Prev 7 Days])` |  |
| **Run Rate (30d) USD** | `[Avg Daily Cost] * 30` | Projected monthly spend at the current daily average. |
| **Cost per Million Rows** | `DIVIDE([Estimated Cost], DIVIDE([Rows (Latest)], 1000000))` | Unit economics: spend against data actually landed. |

### `Hourly_Consumption`

| Measure | DAX | Notes |
|---|---|---|
| **Credits (7d)** | `SUM(Hourly_Consumption[CREDITS_USED])` |  |
| **Cost (7d)** | `SUM(Hourly_Consumption[ESTIMATED_COST_USD])` |  |
| **Active Warehouses** | `DISTINCTCOUNT(Hourly_Consumption[WAREHOUSE_NAME])` |  |
| **Peak Hourly Credits** | `MAX(Hourly_Consumption[CREDITS_USED])` |  |
| **Active Hours** | `CALCULATE(COUNTROWS(Hourly_Consumption), Hourly_Consumption[CREDITS_USED] > 0)` |  |
| **Avg Credits per Active Hour** | `DIVIDE([Credits (7d)], [Active Hours])` |  |

_55 measures._

### Semi-additive handling

`Table_Snapshots` is a daily snapshot: summing `ROW_COUNT` across dates counts
the same table once per day and is meaningless. `Rows (Snapshot)` is the plain
sum, correct only with a single date in context. `Rows (Latest)` wraps it in
`LASTNONBLANK` so totals and cards report the most recent snapshot instead.
Use `(Latest)` for KPIs and `(Snapshot)` for trends over a date axis.

## Regenerating

Both copies are emitted from one definition. Editing either project by hand
will be overwritten on the next generation - change the generator instead, or
stop generating and own the files.

Validate after any hand-edit:

```powershell
.\tools\Validate-Tmdl.ps1 -DefinitionPath ".\dev_reports\Usage_Monitoring.SemanticModel\definition"
```

## First open

Credentials are never stored in the project files. On first open Power BI will
prompt: choose **Key-Pair**, then

| | dev | prod |
|---|---|---|
| User | `SVC_QLIK_DEV` | `SVC_QLIK_PROD` |
| Key file | `Dev_Credintials/qlik_dev_key_unencrypted.p8` | `Prod_Credintials/qlik_prod_key_unencrypted.p8` |
| Passphrase | *(blank)* | *(blank)* |

Use the `_unencrypted` keys. The `BEGIN ENCRYPTED PRIVATE KEY` variants carry an
empty passphrase, which the ADBC driver rejects with
`jwt_private_key_pkcs8_password is not configured`.
