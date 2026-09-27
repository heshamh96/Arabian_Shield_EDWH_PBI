# Snowflake — Arabian Shield GOLD model

> **Prod copy.** Mirrors the dev gold model, repointed at `ARABIANSHIELD_PROD.GOLD`.
> Two objects the model references are not in prod GOLD yet -
> `D_DIM_MEDICAL_POLICY_NETWORK` and `D_DIM_POLICY_BENEFIT` - so those two
> DirectQuery tables error until the platform team lands them; the other 36 work.

Power BI Project (`.pbip`) semantic model over the **GOLD** layer of
`ARABIANSHIELD_PROD`, connected to Snowflake with **key-pair authentication**.

## Connection

Connection settings are M parameters in
[`expressions.tmdl`](Snowflake_Arabian_Shield_Gold_model.SemanticModel/definition/expressions.tmdl)
— change them there, not in 38 separate table queries.

| Parameter | Value |
|---|---|
| `SnowflakeServer` | `ASCI-EDP.snowflakecomputing.com` (account `ZN91934`, `GCP_ME_CENTRAL2`) |
| `SnowflakeWarehouse` | `PROD_GOLD_WH` |
| `SnowflakeDatabase` | `ARABIANSHIELD_PROD` |
| `SnowflakeSchema` | `GOLD` |
| `SnowflakeRole` | `PROD_QLIK_READER_ROLE` |

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
4. Username `SVC_QLIK_PROD`, private key file **`qlik_prod_key_unencrypted.p8`**,
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

`qlik_prod_key_unencrypted.p8` is the same key re-wrapped honestly as
`BEGIN PRIVATE KEY`, produced with:

```bash
openssl pkcs8 -topk8 -nocrypt -in qlik_dev_key.p8 -passin pass: -out qlik_prod_key_unencrypted.p8
```

Same key pair — the public-key fingerprint is unchanged at
`SHA256:8QCU0FRpjvPEdJMnmDaKK2AumsQ0jOkR5FYPzxnFH3o=`, so **nothing needs
re-registering in Snowflake**. This does not weaken anything: a blank passphrase
already offered no protection. It only stops the driver asking for a password
that never existed.

> The real weakness is unchanged and worth fixing: **either key file alone grants
> full `SVC_QLIK_PROD` access.** Re-encrypting with a genuine passphrase
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
..\..\tools\Validate-Tmdl.ps1
```

This validates syntax and structure. It is worth running after any hand-edit to
`definition/`; it is what caught the `///`-on-`relationship` bug.

It does **not** cover Power BI's semantic rules, which are checked later at model
load. Those surface only in the "Issues were found" dialog, whose text is not
exposed to UI Automation. To read that dialog — including over RDP, where screen
capture is unavailable:

```powershell
..\..\tools\Grab-Window.ps1 -TitleLike "Issues were found"
```

That is how the second bug was found: one-to-one relationships must carry
`crossFilteringBehavior: bothDirections`, or load fails with *"CrossFilterDirection
for One-to-One relationships should always be set to BothDirections."*

## Repo layout

Each report lives in its own folder under `dev_reports/` or `prod_reports/`,
holding the `.pbip` pointer and its two artefact folders together so the
relative references between them keep resolving:

```
dev_reports/Snowflake_Arabian_Shield_Gold_model/
  GOLD_MODEL.md                                   this file
  Snowflake_Arabian_Shield_Gold_model.pbip        project pointer
  Snowflake_Arabian_Shield_Gold_model.SemanticModel/
    definition/
      model.tmdl          model settings + table refs
      expressions.tmdl    connection parameters  ← edit here
      relationships.tmdl  55 relationships
      tables/*.tmdl       39 tables, 847 columns
  Snowflake_Arabian_Shield_Gold_model.Report/
    definition/pages/     report pages (one folder per page)
```

38 of the 39 tables are DirectQuery. The exception is
`A_REF_NATIONALITY_RP`, an Import-mode role-playing copy of the nationality
lookup — the fix for the conformed-dimension ambiguity described in
[RELATIONSHIPS.md](../../RELATIONSHIPS.md).

## Secrets

Credentials live in [`Prod_Credintials/`](../../Prod_Credintials) at the repo
root, not in this folder, and are excluded by [`.gitignore`](../../.gitignore).
Verify before any first push to a new remote:

```bash
git check-ignore -v ../../Prod_Credintials/*
```

Two standing risks, unchanged:

- The keys sit **inside** the working tree. One `git add -f` and a key is in
  history permanently. A folder outside the repo removes the risk entirely.
- The key has an **empty passphrase** — the file alone grants full
  `SVC_QLIK_PROD` access. It is also shared with a **Qlik** workload on the same
  service account, so rotating it breaks Qlik too; use `RSA_PUBLIC_KEY_2` to
  rotate without downtime.

See the [root README](../../README.md) for why the connection must use
`qlik_prod_key_unencrypted.p8` rather than the encrypted-looking original.

## Relationships

Built from the `Ref` block of `DWH_Physical_Model_Mix_Prefix_reduced.sql` (the
dbdiagram.io DBML), not guessed from column names — 55 `Ref`s parsed, 27 active,
27 inactive, 1 dropped. Every endpoint is validated against the deployed schema.

**See [RELATIONSHIPS.md](../../RELATIONSHIPS.md)** for the full edge list, why each
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
