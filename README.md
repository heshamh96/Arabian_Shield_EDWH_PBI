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

Credentials are **not** in this repo, and cannot be — Power BI keeps them in the
Windows credential store, never in the project files. That is by design; it is
also why every new machine has to do this once.

1. Open `Snowflake_Arabian_Shield_Gold_model.pbip`.
2. Click **Refresh now** on the "relationships have been modified" banner.
3. Choose **Key-Pair** authentication.
4. Username `SVC_QLIK_DEV`, private key file **`qlik_dev_key_unencrypted.p8`**,
   passphrase **blank**.

### Use the unencrypted key, not `qlik_dev_key.p8`

`qlik_dev_key.p8` is PKCS#8 `BEGIN ENCRYPTED PRIVATE KEY` but opens with an
*empty* passphrase. The ADBC driver sees the "encrypted" wrapper and requires a
passphrase option; Power BI only sends one if you type something; you have
nothing to type. Result:

```
ADBC: [snowflake] adbc.snowflake.sql.client_option.jwt_private_key_pkcs8_password
is not configured.
```

`qlik_dev_key_unencrypted.p8` is the same key re-wrapped honestly as
`BEGIN PRIVATE KEY`, produced with:

```bash
openssl pkcs8 -topk8 -nocrypt -in qlik_dev_key.p8 -passin pass: -out qlik_dev_key_unencrypted.p8
```

Same key pair — the public-key fingerprint is unchanged at
`SHA256:8QCU0FRpjvPEdJMnmDaKK2AumsQ0jOkR5FYPzxnFH3o=`, so **nothing needs
re-registering in Snowflake**. This does not weaken anything: a blank passphrase
already offered no protection. It only stops the driver asking for a password
that never existed.

> The real weakness is unchanged and worth fixing: **either key file alone grants
> full `SVC_QLIK_DEV` access.** Re-encrypting with a genuine passphrase
> (`openssl pkcs8 -topk8 -v2 aes-256-cbc -in qlik_dev_key.p8 -out key_enc.p8`)
> and typing it once in the Key-Pair dialog is the proper fix.

Key-pair auth requires the **ADBC** driver — Power BI selects it automatically
and ignores any `Implementation="1.0"` (ODBC) setting.

### If Power BI keeps failing with a cached credential

Desktop remembers the failed attempt. Clear it before retrying:

**File → Options and settings → Data source settings →** select
`ASCI-EDP.snowflakecomputing.com` **→ Clear Permissions**, then refresh again.

## Validating the model without opening Power BI

Opening the `.pbip` takes ~90s and reports problems only through a dialog. To
check the TMDL in about a second using Power BI's own parser:

```powershell
.\tools\Validate-Tmdl.ps1
```

This validates syntax and structure. It is worth running after any hand-edit to
`definition/`; it is what caught the `///`-on-`relationship` bug.

It does **not** cover Power BI's semantic rules, which are checked later at model
load. Those surface only in the "Issues were found" dialog, whose text is not
exposed to UI Automation. To read that dialog — including over RDP, where screen
capture is unavailable:

```powershell
.\tools\Grab-Window.ps1 -TitleLike "Issues were found"
```

That is how the second bug was found: one-to-one relationships must carry
`crossFilteringBehavior: bothDirections`, or load fails with *"CrossFilterDirection
for One-to-One relationships should always be set to BothDirections."*

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

## Relationships

Built from the `Ref` block of `DWH_Physical_Model_Mix_Prefix_reduced.sql` (the
dbdiagram.io DBML), not guessed from column names — 55 `Ref`s parsed, 27 active,
27 inactive, 1 dropped. Every endpoint is validated against the deployed schema.

**See [RELATIONSHIPS.md](RELATIONSHIPS.md)** for the full edge list, why each
inactive one is inactive, and the path that substitutes for it.

The short version: GOLD is a snowflake, so facts reach the same dimension by
several routes, and the Tabular engine rejects cycles among active
relationships. The active set is a forest chosen by the DBML's stated design —
subtype links and the dimension spine first, facts at their finest grain, and
conformed `A_REF_*` lookups **last** so a 931-row nationality table never becomes
a bridge between unrelated entities. Every active edge joins matching key names;
all 9 role-playing FKs are inactive and want `USERELATIONSHIP`.

⚠️ Keep **Options → Data Load → Autodetect new relationships** *off*. The DBML
warns that "BI tools bind on matching column names, so the column WAS the
relationship" — columns were deleted upstream precisely to stop spurious joins,
and autodetect would put them back.

## Not yet modelled

- **No measures.** No DAX has been written yet.
- Auto date/time is **off** (`__PBI_TimeIntelligenceEnabled = 0`): it is
  unsupported in DirectQuery and would otherwise generate a hidden date table
  per date column (131 here). Use `A_DIM_DATE` as the date dimension.
