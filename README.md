# Arabian Shield — EDWH Power BI

Power BI Projects (`.pbip`) over the Arabian Shield Snowflake warehouse, held as
plain text so they can be diffed, reviewed and branched like any other code.

## Layout

```
dev_reports/                         → ASCI-EDP (account ZN91934)
  Snowflake_Arabian_Shield_Gold_model.*   insurance model over ARABIANSHIELD_DEV.GOLD
  Usage_Monitoring.*                      platform telemetry over MONITORING_DB
  GOLD_MODEL.md                           docs for the gold model
prod_reports/                        → ASCI-EDP_PRD (account TG52301)
  Usage_Monitoring.*                      same report, prod parameters
                                          (a prod gold model will land here later)
Dev_Credintials/  Prod_Credintials/  keys + connection metadata — gitignored
tools/                               validation, screen capture, generators
RELATIONSHIPS.md                     gold model relationship audit
USAGE_MONITORING.md                  usage monitoring measures and gaps
DWH_Physical_Model_Mix_Prefix_reduced.sql   dbdiagram.io physical model (source of truth
                                            for the gold model's relationships)
```

## Environments

| | dev | prod |
|---|---|---|
| Server | `ASCI-EDP.snowflakecomputing.com` | `ASCI-EDP_PRD.snowflakecomputing.com` |
| Account | `ZN91934` | `TG52301` |
| User | `SVC_QLIK_DEV` | `SVC_QLIK_PROD` |
| Role | `DEV_QLIK_READER_ROLE` | `PROD_QLIK_READER_ROLE` |
| Warehouse | `DEV_GOLD_WH` | `PROD_GOLD_WH` |
| Layers present | BRONZE, SILVER, **GOLD** | BRONZE, SILVER (no GOLD yet) |

Both accounts are on `GCP_ME_CENTRAL2`. Both connections are verified working
with key-pair authentication.

Every report reads its connection from M parameters in `expressions.tmdl`, so
repointing an environment is one file, not one edit per table.

## Reports

| Report | Docs | Storage mode | Why |
|---|---|---|---|
| Gold model | [dev_reports/GOLD_MODEL.md](dev_reports/GOLD_MODEL.md) | DirectQuery | `D_DIM_POLICY_BENEFIT` alone is ~305M rows |
| Usage monitoring | [USAGE_MONITORING.md](USAGE_MONITORING.md) | Import | whole model is well under 1M rows |

## Credentials

Never stored in the project files — Power BI keeps them in the Windows
credential store. On first open, choose **Key-Pair** and point at the
**`_unencrypted`** key for the environment:

| | dev | prod |
|---|---|---|
| User | `SVC_QLIK_DEV` | `SVC_QLIK_PROD` |
| Key | `Dev_Credintials/qlik_dev_key_unencrypted.p8` | `Prod_Credintials/qlik_prod_key_unencrypted.p8` |
| Passphrase | *(blank)* | *(blank)* |

⚠️ **Use the `_unencrypted` keys.** The plain `.p8` files are
`BEGIN ENCRYPTED PRIVATE KEY` but carry an *empty* passphrase. The ADBC driver
sees the encrypted wrapper and demands a passphrase option that Power BI never
sends, failing with:

```
ADBC: [snowflake] adbc.snowflake.sql.client_option.jwt_private_key_pkcs8_password is not configured
```

The unencrypted copies are the same key pair — identical public-key
fingerprints, so nothing needs re-registering in Snowflake. Conversion:

```bash
openssl pkcs8 -topk8 -nocrypt -in qlik_dev_key.p8 -passin pass: -out qlik_dev_key_unencrypted.p8
```

## Secrets

`Dev_Credintials/` and `Prod_Credintials/` are excluded by
[`.gitignore`](.gitignore) (`*.p8`, `*.pem`, `*credential*`, `credinitals.txt`).
Nothing sensitive has ever been committed. Verify before pushing to a new remote:

```bash
git check-ignore -v Dev_Credintials/* Prod_Credintials/*
```

Two standing risks, unchanged:

- Both private keys have **no passphrase** — either file alone grants full access
  to its environment.
- The dev key is shared with a **Qlik** workload on the same service account, so
  rotating it breaks Qlik too. Use `RSA_PUBLIC_KEY_2` to rotate without downtime.

## Tools

| Tool | Purpose |
|---|---|
| [`tools/Validate-Tmdl.ps1`](tools/Validate-Tmdl.ps1) | Parse a semantic model with Power BI's own TMDL parser in ~1s, instead of a 90s Desktop launch. Syntax only — Power BI applies further semantic rules at load. |
| [`tools/Grab-Window.ps1`](tools/Grab-Window.ps1) | Capture a window to PNG via `PrintWindow`. Reads Power BI's "Issues were found" dialog, whose text is invisible to UI Automation, and works over RDP where screen capture does not. |
| [`tools/usage-monitoring/`](tools/usage-monitoring) | Generators that emit both Usage_Monitoring projects from one definition. |
