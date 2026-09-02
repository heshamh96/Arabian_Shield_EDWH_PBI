# Snowflake — Arabian Shield GOLD model

Power BI Project (`.pbip`) semantic model over the **GOLD** layer of
`ARABIANSHIELD_DEV`, connected to Snowflake with **key-pair authentication**.

## Connection

Connection settings are M parameters in
[`expressions.tmdl`](Snowflake_Arabian_Shield_Gold_model.SemanticModel/definition/expressions.tmdl)
— change them there, not in 38 separate table queries.

| Parameter | Value |
|---|---|
| `SnowflakeServer` | `ASCI-EDP.snowflakecomputing.com` (account `ZN91934`, `GCP_ME_CENTRAL2`) |
| `SnowflakeWarehouse` | `DEV_GOLD_WH` |
| `SnowflakeDatabase` | `ARABIANSHIELD_DEV` |
| `SnowflakeSchema` | `GOLD` |
| `SnowflakeRole` | `DEV_QLIK_READER_ROLE` |

Storage mode is **DirectQuery** for every table. This is deliberate:
`D_DIM_POLICY_BENEFIT` alone has ~305M rows, and three other tables are in the
12–20M range. Import would be unworkable and would bloat `cache.abf`.

## First-time setup (per machine)

Credentials are *not* in this repo — Power BI keeps them in the Windows
credential store. On first open, Desktop will prompt:

1. Open `Snowflake_Arabian_Shield_Gold_model.pbip`.
2. At the Snowflake prompt choose **Key-Pair** authentication.
3. Username `SVC_QLIK_DEV`, private key file `qlik_dev_key.p8`, passphrase **blank**.

Key-pair auth requires the **ADBC** driver — Power BI selects it automatically
and ignores any `Implementation="1.0"` (ODBC) setting.

## Repo layout

```
Snowflake_Arabian_Shield_Gold_model.pbip          project pointer
Snowflake_Arabian_Shield_Gold_model.SemanticModel/
  definition/
    model.tmdl          model settings + table refs
    expressions.tmdl    connection parameters  ← edit here
    tables/*.tmdl       38 tables, 838 columns
Snowflake_Arabian_Shield_Gold_model.Report/
  definition/pages/     report pages (one folder per page)
```

## Secrets

`qlik_dev_key.p8` and `credinitals.txt` live in this folder but are excluded by
[`.gitignore`](.gitignore). Verify before any first push to a new remote:

```powershell
git check-ignore -v qlik_dev_key.p8 credinitals.txt   # must print a match for each
```

Two standing risks worth fixing:

- The private key sits **inside** the working tree. One `git add -f` and it is in
  history permanently. Moving it to a folder outside the repo removes the risk.
- The key has an **empty passphrase** — the file alone grants full
  `SVC_QLIK_DEV` access. Re-encrypting it with a real passphrase is cheap:
  `openssl pkcs8 -topk8 -v2 aes-256-cbc -in qlik_dev_key.p8 -out qlik_dev_key_enc.p8`
  (no Snowflake-side change needed; the key pair itself is unchanged).

## Not yet modelled

- **No relationships.** GOLD defines no foreign-key constraints, so there was
  nothing to derive them from — inferring 38 tables' worth from column names
  would produce silently wrong numbers. Define them deliberately.
- **No measures.** No DAX has been written yet.
- Auto date/time is **off** (`__PBI_TimeIntelligenceEnabled = 0`): it is
  unsupported in DirectQuery and would otherwise generate a hidden date table
  per date column (131 here). Use `A_DIM_DATE` as the date dimension.
