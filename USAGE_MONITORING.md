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

## Branding

The Arabian Shield palette was taken from the live site (der3.com) by reading
its computed styles rather than eyeballing a screenshot:

| Role | Hex | Where it comes from |
|---|---|---|
| Primary green | `#00602F` | nav bar / "Contact us" button |
| Accent lime | `#81A53F` | "Get a quote" button |
| Deep greens | `#1F6035` `#146032` | secondary surfaces |
| Ink | `#1D1D1B` | body text |

It ships as the report **base theme**
(`StaticResources/SharedResources/BaseThemes/ArabianShield.json`), not as a
`customTheme`. That matters: registering it as a customTheme - tried under both
`SharedResources` and `RegisteredResources` - makes Power BI reject the whole
report layer. Every page vanishes while the semantic model still loads fine, so
the TMDL validator reports OK and the failure looks like a data problem.

Only the first two categorical slots are brand greens. Series three onward move
to complementary hues, because four shades of green in one chart is unreadable.

## Report features

Each was verified in Desktop individually - see `UM_FEATURES` in
`tools/usage-monitoring/build-usage.js`.

| Feature | State | Note |
|---|---|---|
| `theme` + `vstyles` | **on** | brand palette, green table headers, styled slicers and titles |
| `hier` | **on** | drill-down hierarchies: Layer → Schema → Table, Year → Month → Date |
| `chrome` | **on** | brand header band and page title |
| slicers | **on** | Date (range), Layer, Month on every page |
| `pagenav` | **on** | built-in pageNavigator: one labelled button per page, current page highlighted |
| `nav` | **off** | hand-rolled `actionButton`s rendered as unlabelled boxes - the `text` object is never applied, even with an explicit `default` state selector. `pagenav` replaces them. |
| `tips` | **off** | report-page tooltips and the drillthrough detail page. The `pageBinding` shape for Tooltip/Drillthrough pages is wrong somewhere and takes the whole report layer down with it. Default hover tooltips still work. |

Both `nav` and `tips` are one flag away once the correct JSON shape is known;
the pages and buttons are already written in `pages.js`.

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

- **Overview** - 17 visuals
- **Cost & Consumption** - 16 visuals
- **Pipeline Health** - 17 visuals
- **Data Growth** - 17 visuals
- **Table Inventory** - 15 visuals
- **Warehouse Efficiency** - 16 visuals
- **Refresh Deep Dive** - 17 visuals
- **Freshness & SLA** - 17 visuals
- **Executive Summary** - 16 visuals

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
| **Refresh Days** | `DISTINCTCOUNT(DTS_Refresh[REFRESH_DATE])` |  |
| **Refreshes per Day** | `DIVIDE([Total Refreshes], [Refresh Days])` |  |
| **Avg Refresh Duration (s)** | `AVERAGE(DTS_Refresh[REFRESH_DURATION_SEC])` |  |
| **Median Refresh Duration (s)** | `MEDIANX(DTS_Refresh, DTS_Refresh[REFRESH_DURATION_SEC])` | Half of refreshes finish faster than this. |
| **Max Refresh Duration (s)** | `MAX(DTS_Refresh[REFRESH_DURATION_SEC])` |  |
| **P95 Refresh Duration (s)** | `PERCENTILEX.INC(DTS_Refresh, DTS_Refresh[REFRESH_DURATION_SEC], 0.95)` | Tail latency - a better health signal than the average. |
| **Total Refresh Hours** | `DIVIDE(SUM(DTS_Refresh[REFRESH_DURATION_SEC]), 3600)` | Compute time spent refreshing; drives cost. |
| **Avg Queued (ms)** | `AVERAGE(DTS_Refresh[QUEUED_MS])` | Sustained queueing means the warehouse is undersized. |
| **Queue Share %** | `DIVIDE(SUM(DTS_Refresh[QUEUED_MS]), SUM(DTS_Refresh[QUEUED_MS]) + SUM(DTS_Refresh[EXECUTION_MS]) + SUM(DTS_Refresh[COMPILATION_MS]))` | Portion of elapsed time spent waiting rather than working. |
| **Target Lag Breaches** | `CALCULATE([Total Refreshes], DTS_Refresh[EXCEEDED_TARGET_LAG] = TRUE())` | Refreshes that missed their freshness SLA. |
| **Target Lag Breach %** | `DIVIDE([Target Lag Breaches], [Total Refreshes])` |  |
| **Avg Lag Overage (min)** | `AVERAGE(DTS_Refresh[LAG_OVERAGE_MIN])` | How far past target lag the breaches ran. |
| **Worst Lag Overage (min)** | `MAX(DTS_Refresh[LAG_OVERAGE_MIN])` |  |
| **Rows Inserted** | `SUM(DTS_Refresh[ROWS_INSERTED])` |  |
| **Rows Deleted** | `SUM(DTS_Refresh[ROWS_DELETED])` |  |
| **Net Rows Changed** | `[Rows Inserted] - [Rows Deleted]` |  |
| **Rows per Refresh Second** | `DIVIDE([Rows Inserted], SUM(DTS_Refresh[REFRESH_DURATION_SEC]))` | Throughput. A falling value on steady volume means degradation. |
| **No-Data Refresh %** | `DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] = "NO_DATA"), [Total Refreshes])` | Scheduled runs that found nothing to do - candidates for a longer target lag. |
| **Distinct Errors** | `CALCULATE(DISTINCTCOUNT(DTS_Refresh[REFRESH_ERROR_MSG]), NOT ISBLANK(DTS_Refresh[REFRESH_ERROR_MSG]))` |  |
| **Slowest Table** | `CALCULATE(FIRSTNONBLANK(DTS_Refresh[TABLE_NAME], 1), TOPN(1, ALLSELECTED(DTS_Refresh[TABLE_NAME]), [Avg Refresh Duration (s)], DESC))` | Name of the table with the highest average refresh duration in the current filter. |
| **Failures Last 7 Days** | `CALCULATE([Failed Refreshes], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY))` |  |
| **Tables with Failures** | `CALCULATE(DISTINCTCOUNT(DTS_Refresh[TABLE_NAME]), DTS_Refresh[REFRESH_STATE] IN {"FAILED", "UPSTREAM_FAILED"})` | How many distinct tables are failing - one broken table failing often is a very different problem from many tables failing once. |
| **Avg Compilation (ms)** | `AVERAGE(DTS_Refresh[COMPILATION_MS])` |  |
| **Avg Execution (ms)** | `AVERAGE(DTS_Refresh[EXECUTION_MS])` |  |
| **Compile Share %** | `DIVIDE(SUM(DTS_Refresh[COMPILATION_MS]), SUM(DTS_Refresh[COMPILATION_MS]) + SUM(DTS_Refresh[EXECUTION_MS]))` | High compile share on short refreshes means planning costs more than the work. |
| **Incremental Refresh %** | `DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] = "INCREMENTAL"), [Total Refreshes])` |  |
| **Full Refresh %** | `DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_ACTION] IN {"FULL", "REINITIALIZE"}), [Total Refreshes])` | Full rebuilds are the expensive path; a rising share is worth chasing. |
| **Scheduled Refresh %** | `DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_TRIGGER] = "SCHEDULED"), [Total Refreshes])` |  |
| **Manual Refresh %** | `DIVIDE(CALCULATE([Total Refreshes], DTS_Refresh[REFRESH_TRIGGER] = "MANUAL"), [Total Refreshes])` | Manual runs suggest someone is compensating for a schedule that does not fit. |
| **Avg Rows per Refresh** | `DIVIDE([Rows Inserted], [Total Refreshes])` |  |
| **Refresh Hours per Table** | `DIVIDE([Total Refresh Hours], [Tables Refreshed])` |  |
| **Failure Concentration %** | `DIVIDE(MAXX(VALUES(DTS_Refresh[TABLE_NAME]), [Failed Refreshes]), [Failed Refreshes])` | Share of all failures coming from the single worst table. |

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
| **Rows 30D Ago** | `CALCULATE([Rows (Latest)], DATEADD('Date'[Date], -30, DAY))` |  |
| **Row Growth 30D %** | `DIVIDE([Rows (Latest)] - [Rows 30D Ago], [Rows 30D Ago])` |  |
| **Avg Daily Row Growth** | `DIVIDE([Row Growth 30D %] * [Rows 30D Ago], 30)` | Mean rows added per day over the last 30 days. |
| **Tables in Snapshot** | `DISTINCTCOUNT(Table_Snapshots[TABLE_NAME])` |  |
| **Avg Bytes per Row** | `DIVIDE(CALCULATE(SUM(Table_Snapshots[BYTES]), LASTNONBLANK('Date'[Date], [Rows (Snapshot)])), [Rows (Latest)])` | Row width. A jump usually means a schema change or poor clustering. |
| **Fastest Growing Table** | `CALCULATE(FIRSTNONBLANK(Table_Snapshots[TABLE_NAME], 1), TOPN(1, ALLSELECTED(Table_Snapshots[TABLE_NAME]), [Row Growth 7D], DESC))` |  |
| **Tables Growing** | `COUNTROWS(FILTER(VALUES(Table_Snapshots[TABLE_NAME]), [Row Growth 7D] > 0))` |  |
| **Tables Shrinking** | `COUNTROWS(FILTER(VALUES(Table_Snapshots[TABLE_NAME]), [Row Growth 7D] < 0))` | Shrinking tables are usually intentional pruning - or an upstream feed that broke. |
| **Tables Static 7D** | `COUNTROWS(FILTER(VALUES(Table_Snapshots[TABLE_NAME]), [Row Growth 7D] = 0))` |  |
| **Daily Growth GB** | `DIVIDE([Storage GB (Latest)] - [Storage GB 7D Ago], 7)` |  |
| **Projected GB in 90d** | `[Storage GB (Latest)] + [Daily Growth GB] * 90` | Straight-line projection from the last 7 days - a planning hint, not a forecast. |

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
| **Empty Table %** | `DIVIDE([Empty Tables], [Tables Monitored])` |  |
| **Avg Rows per Table** | `DIVIDE([Current Rows], [Tables Monitored])` |  |
| **Largest Table Rows** | `MAX(Current_Tables[ROW_COUNT])` |  |
| **Largest Table** | `CALCULATE(FIRSTNONBLANK(Current_Tables[TABLE_NAME], 1), TOPN(1, ALLSELECTED(Current_Tables[TABLE_NAME]), [Current Rows], DESC))` | Name of the biggest table by row count in the current filter. |
| **Stale Tables (30d)** | `CALCULATE([Tables Monitored], FILTER(Current_Tables, Current_Tables[LAST_ALTERED] < TODAY() - 30))` | Not altered in 30 days - either stable reference data or a stalled feed. |
| **Avg Retention Days** | `AVERAGE(Current_Tables[RETENTION_TIME])` |  |
| **Median Rows per Table** | `MEDIANX(Current_Tables, Current_Tables[ROW_COUNT])` | With a 300M-row outlier present, the median describes the estate better than the mean. |
| **Storage Concentration %** | `DIVIDE(MAXX(VALUES(Current_Tables[TABLE_NAME]), [Current Storage GB]), [Current Storage GB])` | Share of all storage held by the single largest table. |
| **Tables > 1M Rows** | `CALCULATE([Tables Monitored], FILTER(Current_Tables, Current_Tables[ROW_COUNT] > 1000000))` |  |
| **Largest Table GB** | `DIVIDE(MAX(Current_Tables[BYTES]), 1073741824)` |  |
| **Newest Table Date** | `MAX(Current_Tables[CREATED_AT])` |  |
| **Last Change** | `MAX(Current_Tables[LAST_ALTERED])` | Most recent write anywhere in the current filter - a staleness canary. |

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
| **Cost MTD** | `CALCULATE([Estimated Cost], DATESMTD('Date'[Date]))` |  |
| **Credits 7D Avg** | `AVERAGEX(DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY), [Total Credits])` | Rolling mean - smooths the weekday/weekend saw-tooth. |
| **Run Rate (30d) USD** | `[Avg Daily Cost] * 30` | Projected monthly spend at the current daily average. |
| **Cost per Million Rows** | `DIVIDE([Estimated Cost], DIVIDE([Rows (Latest)], 1000000))` | Unit economics: spend against data actually landed. |
| **Cost per GB Stored** | `DIVIDE([Estimated Cost], [Storage GB (Latest)])` |  |
| **Credits per Refresh Hour** | `DIVIDE([Total Credits], [Total Refresh Hours])` | Credit burn per hour of dynamic-table refresh work. |
| **Cost Volatility** | `STDEVX.P(VALUES(Daily_Consumption[USAGE_DATE]), [Estimated Cost])` | Day-to-day spread of daily spend. High volatility makes a run rate meaningless. |
| **Days Above Avg Cost** | `COUNTROWS(FILTER(VALUES(Daily_Consumption[USAGE_DATE]), [Estimated Cost] > [Avg Daily Cost]))` |  |
| **Weekend Cost** | `CALCULATE([Estimated Cost], 'Date'[Is Weekend] = TRUE())` |  |
| **Weekend Cost %** | `DIVIDE([Weekend Cost], [Estimated Cost])` | Spend on days nobody is working - usually pure schedule cost. |
| **Most Expensive Day** | `CALCULATE(FIRSTNONBLANK('Date'[Date], 1), TOPN(1, ALLSELECTED('Date'[Date]), [Estimated Cost], DESC))` |  |
| **Credits per GB Stored** | `DIVIDE([Total Credits], [Storage GB (Latest)])` |  |

### `Hourly_Consumption`

| Measure | DAX | Notes |
|---|---|---|
| **Credits (7d)** | `SUM(Hourly_Consumption[CREDITS_USED])` |  |
| **Cost (7d)** | `SUM(Hourly_Consumption[ESTIMATED_COST_USD])` |  |
| **Active Warehouses** | `DISTINCTCOUNT(Hourly_Consumption[WAREHOUSE_NAME])` |  |
| **Peak Hourly Credits** | `MAX(Hourly_Consumption[CREDITS_USED])` |  |
| **Active Hours** | `CALCULATE(COUNTROWS(Hourly_Consumption), Hourly_Consumption[CREDITS_USED] > 0)` |  |
| **Idle Hours** | `CALCULATE(COUNTROWS(Hourly_Consumption), Hourly_Consumption[CREDITS_USED] = 0)` |  |
| **Avg Credits per Active Hour** | `DIVIDE([Credits (7d)], [Active Hours])` |  |
| **Busiest Hour** | `CALCULATE(FIRSTNONBLANK(Hourly_Consumption[USAGE_HOUR], 1), TOPN(1, ALLSELECTED(Hourly_Consumption[USAGE_HOUR]), [Credits (7d)], DESC))` | Hour of day with the highest credit burn. |
| **Utilisation %** | `DIVIDE([Active Hours], COUNTROWS(Hourly_Consumption))` | Share of monitored hours where the warehouse did any work. |
| **Off-Hours Credits** | `CALCULATE([Credits (7d)], Hourly_Consumption[USAGE_HOUR] < 7 \|\| Hourly_Consumption[USAGE_HOUR] > 19)` |  |
| **Off-Hours Credits %** | `DIVIDE([Off-Hours Credits], [Credits (7d)])` | Burn outside 07:00-19:00. Fine for batch, worth questioning otherwise. |
| **Top Warehouse** | `CALCULATE(FIRSTNONBLANK(Hourly_Consumption[WAREHOUSE_NAME], 1), TOPN(1, ALLSELECTED(Hourly_Consumption[WAREHOUSE_NAME]), [Credits (7d)], DESC))` |  |
| **Warehouse Concentration %** | `DIVIDE(MAXX(VALUES(Hourly_Consumption[WAREHOUSE_NAME]), [Credits (7d)]), [Credits (7d)])` | Share of credits burned by the single busiest warehouse. |
| **Busiest Day of Week** | `CALCULATE(FIRSTNONBLANK('Date'[Day of Week], 1), TOPN(1, ALLSELECTED('Date'[Day of Week]), [Credits (7d)], DESC))` |  |

_115 measures._

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
