// =====================================================================
// Arabian Shield — Data Warehouse Physical Data Model — REDUCED
// SQL Dialect: Snowflake  |  DBML (dbdiagram.io)
//
// Identical to DWH_Physical_Model_Mix_Prefix.sql except that each table keeps
// ONLY its primary key and its relationship (foreign key) columns. Table names,
// status symbols, column names, types and the Ref block are byte-identical to the
// full model — descriptive attributes, measures and the audit tail are removed.
// =====================================================================

// ---------------------------------------------------------------------
// STATUS LEGEND (kept current — see Misc/AS_Gold_layer-Skill/SKILL.md §10)
//   ✅ model reviewed and finished with the business   ❌ not reviewed yet
//   ☘️ every relationship touching it resolves clean    ✂️ one or more still orphan
//   🔑 declared PK measured unique on the deployed table 💥 PK HAS DUPLICATES
// All three flags are facts, not opinions: ✅ comes from Misc/Progress_Buckets.md,
// ☘️/✂️ from the last `dbt test --select models/Gold` run (inbound AND outbound),
// and 🔑/💥 from the `unique` test on the model's key in gold_models.yml:
//     uv run dbt test --profiles-dir Connections --select "models/Gold,test_name:unique"
// pass -> 🔑, warn/fail -> 💥, and the note quotes that test's own failure count. The test is
// the authority, not an ad-hoc count(*) query.
//
// READ THIS BEFORE TRUSTING AN ARROW. 💥 means the table's PK is NOT unique, so every
// Ref pointing INTO it is drawn as if that side were unique (whether > or -) but BEHAVES
// many-to-many: a join through it fans out and will inflate any measure you aggregate. The `primary key` marker below is
// kept because it is the INTENDED grain -- 💥 is how you tell intent from reality.
// Currently 💥: none -- every declared PK's `unique` test passes, so no Ref in this
// model fans out. All 55 of them behave as drawn.
// ---------------------------------------------------------------------

Table "✅☘️🔑 A_DIM_Line_of_Business" {
  LOB_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 C_DIM_Medical_Classes" {
  MEDICAL_CLASS_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 C_DIM_Medical_Plans" {
  MEDICAL_PLAN_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 A_REF_Vehicle_Types" {
  VEHICLE_TYPE_ID VARCHAR [primary key, not null]
}

Table "✅✂️🔑 A_REF_Nationality" {
  NATIONALITY_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 A_REF_Profession" {
  PROFESSION_ID VARCHAR [primary key, not null]
}

Table "✅✂️🔑 A_REF_Title" {
  TITLE_ID VARCHAR [primary key, not null]
}

Table "✅✂️🔑 A_REF_Endorsment_Types" {
  ENDORSEMENT_TYPE_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 A_REF_Premuim_Status" {
  PREMIUM_STATUS_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 A_REF_Gender" {
  GENDER_ID VARCHAR [primary key, not null]
}

Table "✅☘️🔑 A_REF_Plan_Class" {
  PLAN_CLASS_ID VARCHAR [primary key, not null]
}

Table "✅✂️🔑 B_DIM_Product" {
  PRODUCT_ID VARCHAR [primary key, not null]
  LOB_ID VARCHAR [not null]
}

Table "✅✂️🔑 B_DIM_Parties" {
  PARTY_ID VARCHAR [primary key, not null]
  REINSU_ID VARCHAR
  TITLE_ID VARCHAR
  GENDER_ID VARCHAR
  NATIONALITY_ID VARCHAR
  PROFESSION_ID VARCHAR
}

Table "✅✂️🔑 D_DIM_Treaty_Details" {
  TREATY_ID VARCHAR [primary key, not null]
  PARTY_ID VARCHAR [not null]
  LOB_ID VARCHAR
}

// POLICY_ID not carried, like the other three member dims: the policy is reached THROUGH
// D_DIM_Risk_Master. Added 2026-08-29 — the fourth risk-member subtype of the conceptual model,
// the LA sibling of D_DIM_Life_Beneficiary (which holds the BENFICIARY role, a disjoint population).
// PARTY_ID, GENDER_ID and NATIONALITY_ID also not carried (commented in the model, 2026-08-29/30):
// a member dim describes the risk itself and links to nothing but D_DIM_Risk_Master — no party
// edge, no lookup edges. Gender and nationality are plain attributes.
Table "❌☘️🔑 D_DIM_Life_Risk_Insured_Member" {
  LIFE_RISK_ID VARCHAR [primary key, not null]
  RISK_ID VARCHAR
}

Table "✅✂️🔑 D_DIM_Life_Beneficiary" {
  LIFE_BENEFICIARY_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  NATIONALITY_ID VARCHAR
}

// POLICY_ID commented out 2026-08-26: this dim reaches the policy THROUGH
// D_DIM_Risk_Master (FK_D_DIM_Risk_Master_POLICY_ID), not directly. The column is kept,
// commented, in the model itself.
Table "✅✂️🔑 D_DIM_Medical_Risk_Insured_Member" {
  MID_RISK_ID VARCHAR [primary key, not null]
  RISK_ID VARCHAR
  NATIONALITY_ID VARCHAR
}

// POLICY_ID commented out 2026-08-26: this dim reaches the policy THROUGH
// D_DIM_Risk_Master (FK_D_DIM_Risk_Master_POLICY_ID), not directly. The column is kept,
// commented, in the model itself.
Table "✅☘️🔑 D_DIM_Motor_Risk_Insured_Member" {
  MOTOR_RISK_ID VARCHAR [primary key, not null]
  RISK_ID VARCHAR
}

// POLICY_ID commented out 2026-08-26: this dim reaches the policy THROUGH
// D_DIM_Risk_Master (FK_D_DIM_Risk_Master_POLICY_ID), not directly. The column is kept,
// commented, in the model itself.
Table "✅☘️🔑 D_DIM_Non_Motor_Risk_Insured_Member" {
  NMOTOR_RISK_ID VARCHAR [primary key, not null]
  RISK_ID VARCHAR
}

Table "✅✂️🔑 D_DIM_Risk_Master" {
  RISK_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  MID_RISK_ID VARCHAR
  LIFE_RISK_ID VARCHAR
  NMOTOR_RISK_ID VARCHAR
  MOTOR_RISK_ID VARCHAR
}

Table "✅✂️🔑 C_DIM_Policy_Master" {
  POLICY_ID VARCHAR [primary key, not null]
  PARTY_ID VARCHAR
  LOB_ID VARCHAR
  PRODUCT_ID VARCHAR
  CHANNEL_ID VARCHAR
  ENDORSEMENT_TYPE_ID VARCHAR
  PARTY_ACCOUNT_ID VARCHAR
}

Table "✅✂️🔑 G_DIM_Reinsurance_Share" {
  REINSURANCE_SHARE_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
  TRANSACTION_ID VARCHAR
  TREATY_ID VARCHAR
  PARTY_ID VARCHAR
}

Table "❌✂️ D_DIM_Policy_Benefit" {
  POLICY_ID VARCHAR
  MEDICAL_PLAN_ID VARCHAR
  MEDICAL_CLASS_ID VARCHAR
}

Table "❌✂️ D_DIM_Medical_Policy_Network" {
  POLICY_ID VARCHAR
  MEDICAL_PLAN_ID VARCHAR
  MEDICAL_CLASS_ID VARCHAR
}

// SUB_CLAIM_ID is deliberately NOT listed here. This file carries only primary keys and FK
// columns, and SUB_CLAIM_ID is neither: it is 3 of the claims-detail key's 5 parts and is not
// unique in either dim (motor 426,379 distinct on 427,317 rows; non-motor 38,300 on 40,936).
// An edge drawn on it behaves many-to-many -- that is the defect removed on 2026-08-28. The
// real edge is F_FCT_Claims.CLAIM_DETAIL_ID -> the dims' PRIMARY KEYS, declared below and
// tested in gold_models.yml. The column still exists in the models and in the full file.
Table "✅✂️🔑 E_DIM_Non_Motor_Claims_Details" {
  NMOTOR_CLAIM_DETAIL_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
  CLAIMANT_ID VARCHAR
}

// SUB_CLAIM_ID is deliberately NOT listed here. This file carries only primary keys and FK
// columns, and SUB_CLAIM_ID is neither: it is 3 of the claims-detail key's 5 parts and is not
// unique in either dim (motor 426,379 distinct on 427,317 rows; non-motor 38,300 on 40,936).
// An edge drawn on it behaves many-to-many -- that is the defect removed on 2026-08-28. The
// real edge is F_FCT_Claims.CLAIM_DETAIL_ID -> the dims' PRIMARY KEYS, declared below and
// tested in gold_models.yml. The column still exists in the models and in the full file.
Table "✅✂️🔑 E_DIM_Motor_Claims_Details" {
  MOTOR_CLAIM_DETAIL_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
  CLAIMANT_ID VARCHAR
}

Table "❌☘️🔑 E_DIM_Medical_Claims_Details" {
  CLAIM_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
}

Table "✅☘️🔑 E_DIM_Life_Claims_Details" {
  CLAIM_ID VARCHAR [primary key, not null]
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
}

Table "✅✂️🔑 E_FCT_Transactions" {
  TRANS_ID VARCHAR [primary key, not null]
  PREMIUM_STATUS_ID VARCHAR
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
  PARTY_ID VARCHAR
  BENIFITIONRY_ID VARCHAR
  SALES_CHANNEL_ID VARCHAR
}

// SUB_CLAIM_ID is deliberately NOT listed here. This file carries only primary keys and FK
// columns, and SUB_CLAIM_ID is neither: it is 3 of the claims-detail key's 5 parts and is not
// unique in either dim (motor 426,379 distinct on 427,317 rows; non-motor 38,300 on 40,936).
// An edge drawn on it behaves many-to-many -- that is the defect removed on 2026-08-28. The
// real edge is F_FCT_Claims.CLAIM_DETAIL_ID -> the dims' PRIMARY KEYS, declared below and
// tested in gold_models.yml. The column still exists in the models and in the full file.
Table "❌✂️🔑 F_FCT_Claims" {
  TRANSACTION_ID VARCHAR [primary key, not null]
  CLAIM_DETAIL_ID VARCHAR
  CLAIM_ID VARCHAR
  POLICY_ID VARCHAR
  RISK_ID VARCHAR
  CLAIMANT_ID VARCHAR
}

// =====================================================================
// RELATIONSHIPS  (regenerated from models/Tests/yml_based_tests/gold_models.yml)
// FKs point from a higher granularity prefix to a lower-or-equal one.
// =====================================================================

// -> A_DIM_Line_of_Business
Ref FK_B_DIM_Product_LOB_ID: "✅✂️🔑 B_DIM_Product".LOB_ID > "✅☘️🔑 A_DIM_Line_of_Business".LOB_ID
Ref FK_C_DIM_Policy_Master_LOB_ID: "✅✂️🔑 C_DIM_Policy_Master".LOB_ID > "✅☘️🔑 A_DIM_Line_of_Business".LOB_ID
Ref FK_D_DIM_Treaty_Details_LOB_ID: "✅✂️🔑 D_DIM_Treaty_Details".LOB_ID > "✅☘️🔑 A_DIM_Line_of_Business".LOB_ID

// -> A_REF_Endorsment_Types
Ref FK_C_DIM_Policy_Master_ENDORSEMENT_TYPE_ID: "✅✂️🔑 C_DIM_Policy_Master".ENDORSEMENT_TYPE_ID > "✅✂️🔑 A_REF_Endorsment_Types".ENDORSEMENT_TYPE_ID

// -> A_REF_Gender
// Ref FK_D_DIM_Life_Risk_Insured_Member_GENDER_ID: "❌☘️🔑 D_DIM_Life_Risk_Insured_Member".GENDER_ID > "✅☘️🔑 A_REF_Gender".GENDER_ID   (retired 2026-08-30: member dims carry no lookup edges)
Ref FK_B_DIM_Parties_GENDER_ID: "✅✂️🔑 B_DIM_Parties".GENDER_ID > "✅☘️🔑 A_REF_Gender".GENDER_ID

// -> A_REF_Nationality
// Ref FK_D_DIM_Life_Risk_Insured_Member_NATIONALITY_ID: "❌☘️🔑 D_DIM_Life_Risk_Insured_Member".NATIONALITY_ID > "✅✂️🔑 A_REF_Nationality".NATIONALITY_ID   (retired 2026-08-30: member dims carry no lookup edges)
Ref FK_D_DIM_Life_Beneficiary_NATIONALITY_ID: "✅✂️🔑 D_DIM_Life_Beneficiary".NATIONALITY_ID > "✅✂️🔑 A_REF_Nationality".NATIONALITY_ID
Ref FK_D_DIM_Medical_Risk_Insured_Member_NATIONALITY_ID: "✅✂️🔑 D_DIM_Medical_Risk_Insured_Member".NATIONALITY_ID > "✅✂️🔑 A_REF_Nationality".NATIONALITY_ID
Ref FK_B_DIM_Parties_NATIONALITY_ID: "✅✂️🔑 B_DIM_Parties".NATIONALITY_ID > "✅✂️🔑 A_REF_Nationality".NATIONALITY_ID

// -> A_REF_Premuim_Status
Ref FK_E_FCT_Transactions_PREMIUM_STATUS_ID: "✅✂️🔑 E_FCT_Transactions".PREMIUM_STATUS_ID > "✅☘️🔑 A_REF_Premuim_Status".PREMIUM_STATUS_ID

// -> A_REF_Profession
Ref FK_B_DIM_Parties_PROFESSION_ID: "✅✂️🔑 B_DIM_Parties".PROFESSION_ID > "✅☘️🔑 A_REF_Profession".PROFESSION_ID

// -> A_REF_Title
Ref FK_B_DIM_Parties_TITLE_ID: "✅✂️🔑 B_DIM_Parties".TITLE_ID > "✅✂️🔑 A_REF_Title".TITLE_ID

// -> D_DIM_Life_Risk_Insured_Member
// The fourth subtype, added 2026-08-29, drawn exactly like the other three: once, from the
// supertype, one-to-one. 256,326 = 256,326 on both sides. Until now LIFE_RISK_ID was populated
// on every TCS risk-master row and pointed at nothing.
Ref FK_D_DIM_Risk_Master_LIFE_RISK_ID: "✅✂️🔑 D_DIM_Risk_Master".LIFE_RISK_ID - "❌☘️🔑 D_DIM_Life_Risk_Insured_Member".LIFE_RISK_ID

// -> D_DIM_Medical_Risk_Insured_Member
// Same supertype/subtype 1:1 as motor and non-motor below, and drawn the same way.
// Now a clean bijection on ROWS as well as values: 12,873,358 = 12,873,358 on both sides. Until
// 2026-08-26 both sides carried an identical endorsement-history duplication (16,349,342 rows
// each) and both were flagged 💥. stg_iiris_medical_risk_insured_member now pins to the latest
// endorsement per member -- MIH_POL_MEMBER is the endorsement-history table with true PK
// (PMBRH_UID, PMBRH_ENDT_SRL) -- which cleared both flags at one root, since D_DIM_Risk_Master's
// IIRIS branch reads that same model.
Ref FK_D_DIM_Risk_Master_MID_RISK_ID: "✅✂️🔑 D_DIM_Risk_Master".MID_RISK_ID - "✅✂️🔑 D_DIM_Medical_Risk_Insured_Member".MID_RISK_ID

// RISK_ID is UNIFIED across risk master and all three member dims: same column name, same token,
// measured 100% on each (motor 4,737,044, non-motor 1,945,092, medical 12,873,358). It is asserted
// in gold_models.yml but NOT drawn as a separate Ref, because it is the same edge as the
// FK_D_DIM_Risk_Master_*_RISK_ID lines below, each declared once as one-to-one. Drawing both would
// be the same relationship twice.
// D_DIM_Risk_Master is the supertype; each B_* member dim is a subtype extension of it.
// Measured 1:1 on the deployed tables -- MOTOR_RISK_ID 4,737,044 rows = 4,737,044 distinct on
// BOTH sides, NMOTOR_RISK_ID 1,945,092 = 1,945,092, and the two candidate join paths return
// the identical row pairs. So it is ONE edge, declared once as one-to-one. A reciprocal
// B->C ref alongside it was the same edge twice, and read as many-to-one in both directions.
// -> D_DIM_Motor_Risk_Insured_Member
// The claims dims deliberately do NOT point here. The B_* member dims are subtype extensions of
// D_DIM_Risk_Master, not join targets of their own: a claim reaches a risk via RISK_ID and the
// member from there. D_DIM_*_Claims_Details used to carry MOTOR_RISK_ID / NMOTOR_RISK_ID, which
// declared a second parallel edge to the same entity; both the Refs AND the columns were removed
// 2026-08-26, because BI tools bind on matching column names, so the column WAS the relationship.
// No reach was lost: RISK_ID and the member columns had identical non-null counts.
Ref FK_D_DIM_Risk_Master_MOTOR_RISK_ID: "✅✂️🔑 D_DIM_Risk_Master".MOTOR_RISK_ID - "✅☘️🔑 D_DIM_Motor_Risk_Insured_Member".MOTOR_RISK_ID

// -> D_DIM_Non_Motor_Risk_Insured_Member
Ref FK_D_DIM_Risk_Master_NMOTOR_RISK_ID: "✅✂️🔑 D_DIM_Risk_Master".NMOTOR_RISK_ID - "✅☘️🔑 D_DIM_Non_Motor_Risk_Insured_Member".NMOTOR_RISK_ID

// -> B_DIM_Parties
// IIRIS party edges went from ~37% to ~100% on 2026-08-29. Plain-numeric IIRIS assured codes are
// IIRIS-native parties (3,991,906 of them exist in no ESKA table; every bridge rejected), so
// B_DIM_Parties regained its IIRIS branch from the un-parked stg_iiris_parties and the macro
// tokenizes plain codes 'IIRIS|PARTY|<code>' while dashed codes stay 'ESKA|CUSTOMER|<id>'.
Ref FK_B_DIM_Parties_REINSU_ID: "✅✂️🔑 B_DIM_Parties".REINSU_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_C_DIM_Policy_Master_CHANNEL_ID: "✅✂️🔑 C_DIM_Policy_Master".CHANNEL_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_C_DIM_Policy_Master_PARTY_ACCOUNT_ID: "✅✂️🔑 C_DIM_Policy_Master".PARTY_ACCOUNT_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_C_DIM_Policy_Master_PARTY_ID: "✅✂️🔑 C_DIM_Policy_Master".PARTY_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_E_DIM_Motor_Claims_Details_CLAIMANT_ID: "✅✂️🔑 E_DIM_Motor_Claims_Details".CLAIMANT_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_E_DIM_Non_Motor_Claims_Details_CLAIMANT_ID: "✅✂️🔑 E_DIM_Non_Motor_Claims_Details".CLAIMANT_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
// Ref FK_D_DIM_Life_Risk_Insured_Member_PARTY_ID: "❌☘️🔑 D_DIM_Life_Risk_Insured_Member".PARTY_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID   (retired 2026-08-29: member dims carry no entity links)
Ref FK_D_DIM_Treaty_Details_PARTY_ID: "✅✂️🔑 D_DIM_Treaty_Details".PARTY_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_E_FCT_Transactions_BENIFITIONRY_ID: "✅✂️🔑 E_FCT_Transactions".BENIFITIONRY_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_E_FCT_Transactions_PARTY_ID: "✅✂️🔑 E_FCT_Transactions".PARTY_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_E_FCT_Transactions_SALES_CHANNEL_ID: "✅✂️🔑 E_FCT_Transactions".SALES_CHANNEL_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_G_DIM_Reinsurance_Share_PARTY_ID: "✅✂️🔑 G_DIM_Reinsurance_Share".PARTY_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID
Ref FK_F_FCT_Claims_CLAIMANT_ID: "❌✂️🔑 F_FCT_Claims".CLAIMANT_ID > "✅✂️🔑 B_DIM_Parties".PARTY_ID

// -> B_DIM_Product
// IIRIS went from 0% to 100% on 2026-08-29. B_DIM_Product's IIRIS branch read policy TYPES
// ('IIRIS|100|101'..'109') while the policy master carried PLAN codes — two code domains — and
// the policy master's token used a hard-coded '100' where the company code is '001'. The branch
// now reads the un-parked stg_iiris_product (mim_plan, 108 plans) and the FK is rebuilt in Gold
// from COMP_CODE; 8,382,285 / 8,382,285 IIRIS and 256,365 / 256,365 TCS resolve. The remaining
// 54,924 orphans are ESKA: 37 of 146 policy-type codes on policies are absent from the master.
Ref FK_C_DIM_Policy_Master_PRODUCT_ID: "✅✂️🔑 C_DIM_Policy_Master".PRODUCT_ID > "✅✂️🔑 B_DIM_Product".PRODUCT_ID

// -> C_DIM_Medical_Classes
// Both edges PASS since 2026-08-29 (were 44.6% and 71.0%). The setup master (610 rows) does not
// hold every (plan, class) real policies carry — classes are defined under one plan and used by
// policies on another, with no linking column — so the dimension gained an `observed` branch
// built from the two consuming models' distinct combos (38 rows, CLASS_NAME null). The 610 + 38
// = 648 keys are unique. Gold-only change; the business's stg finalization is untouched.
Ref FK_D_DIM_Medical_Policy_Network_MEDICAL_CLASS_ID: "❌✂️ D_DIM_Medical_Policy_Network".MEDICAL_CLASS_ID > "✅☘️🔑 C_DIM_Medical_Classes".MEDICAL_CLASS_ID
Ref FK_D_DIM_Policy_Benefit_MEDICAL_CLASS_ID: "❌✂️ D_DIM_Policy_Benefit".MEDICAL_CLASS_ID > "✅☘️🔑 C_DIM_Medical_Classes".MEDICAL_CLASS_ID

// -> C_DIM_Medical_Plans
Ref FK_D_DIM_Medical_Policy_Network_MEDICAL_PLAN_ID: "❌✂️ D_DIM_Medical_Policy_Network".MEDICAL_PLAN_ID > "✅☘️🔑 C_DIM_Medical_Plans".MEDICAL_PLAN_ID
Ref FK_D_DIM_Policy_Benefit_MEDICAL_PLAN_ID: "❌✂️ D_DIM_Policy_Benefit".MEDICAL_PLAN_ID > "✅☘️🔑 C_DIM_Medical_Plans".MEDICAL_PLAN_ID

// -> C_DIM_Policy_Master
// The three B_* risk-member dims deliberately do NOT point here. They are subtype extensions of
// D_DIM_Risk_Master and reach the policy THROUGH it, via FK_D_DIM_Risk_Master_POLICY_ID below.
// Each used to carry its own POLICY_ID, which was a second parallel route to the same entity --
// and since BI tools bind on matching column names, the column WAS the relationship. Commented out
// in the models 2026-08-26 rather than deleted (§4.4).
Ref FK_D_DIM_Life_Beneficiary_POLICY_ID: "✅✂️🔑 D_DIM_Life_Beneficiary".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
// Ref FK_D_DIM_Medical_Risk_Insured_Member_POLICY_ID: "✅✂️🔑 D_DIM_Medical_Risk_Insured_Member".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
// Ref FK_D_DIM_Motor_Risk_Insured_Member_POLICY_ID: "✅☘️🔑 D_DIM_Motor_Risk_Insured_Member".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
// Ref FK_D_DIM_Non_Motor_Risk_Insured_Member_POLICY_ID: "✅☘️🔑 D_DIM_Non_Motor_Risk_Insured_Member".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_D_DIM_Risk_Master_POLICY_ID: "✅✂️🔑 D_DIM_Risk_Master".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_E_DIM_Life_Claims_Details_POLICY_ID: "✅☘️🔑 E_DIM_Life_Claims_Details".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_E_DIM_Medical_Claims_Details_POLICY_ID: "❌☘️🔑 E_DIM_Medical_Claims_Details".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_D_DIM_Medical_Policy_Network_POLICY_ID: "❌✂️ D_DIM_Medical_Policy_Network".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_E_DIM_Motor_Claims_Details_POLICY_ID: "✅✂️🔑 E_DIM_Motor_Claims_Details".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_E_DIM_Non_Motor_Claims_Details_POLICY_ID: "✅✂️🔑 E_DIM_Non_Motor_Claims_Details".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_D_DIM_Policy_Benefit_POLICY_ID: "❌✂️ D_DIM_Policy_Benefit".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_E_FCT_Transactions_POLICY_ID: "✅✂️🔑 E_FCT_Transactions".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_G_DIM_Reinsurance_Share_POLICY_ID: "✅✂️🔑 G_DIM_Reinsurance_Share".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID
Ref FK_F_FCT_Claims_POLICY_ID: "❌✂️🔑 F_FCT_Claims".POLICY_ID > "✅✂️🔑 C_DIM_Policy_Master".POLICY_ID

// -> D_DIM_Risk_Master
Ref FK_E_DIM_Life_Claims_Details_RISK_ID: "✅☘️🔑 E_DIM_Life_Claims_Details".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID
Ref FK_E_DIM_Medical_Claims_Details_RISK_ID: "❌☘️🔑 E_DIM_Medical_Claims_Details".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID
Ref FK_E_DIM_Motor_Claims_Details_RISK_ID: "✅✂️🔑 E_DIM_Motor_Claims_Details".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID
Ref FK_E_DIM_Non_Motor_Claims_Details_RISK_ID: "✅✂️🔑 E_DIM_Non_Motor_Claims_Details".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID
// E_FCT_Transactions.RISK_ID was null on every row until 2026-08-29 (declared, tested, vacuous).
// Now populated wherever the policy has exactly ONE risk — unambiguous by construction, no fan-out:
// 14,688,095 of 15,791,881 rows (ESKA 85.1%, IIRIS 91.8%, TCS 99.98%), all resolving.
Ref FK_E_FCT_Transactions_RISK_ID: "✅✂️🔑 E_FCT_Transactions".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID
Ref FK_F_FCT_Claims_RISK_ID: "❌✂️🔑 F_FCT_Claims".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID
Ref FK_G_DIM_Reinsurance_Share_RISK_ID: "✅✂️🔑 G_DIM_Reinsurance_Share".RISK_ID > "✅✂️🔑 D_DIM_Risk_Master".RISK_ID

// -> E_DIM_Life_Claims_Details
// TCS rows only; ESKA reaches its claim through SUB_CLAIM_ID instead. 267,440/267,440 = 100%
// after the stg float-cast fix (it was 66.2% while ids rendered in scientific notation).
Ref FK_F_FCT_Claims_CLAIM_ID: "❌✂️🔑 F_FCT_Claims".CLAIM_ID > "✅☘️🔑 E_DIM_Life_Claims_Details".CLAIM_ID

// -> E_DIM_Motor_Claims_Details / E_DIM_Non_Motor_Claims_Details
// F_FCT_Claims.CLAIM_DETAIL_ID is a POLYMORPHIC FK: one column, two targets, disjoint partition --
// 1,682,450 rows into motor, 149,398 into non-motor, 1,831,848 = 100% of the ESKA rows. Null on
// TCS, which reaches its claim via CLAIM_ID -> E_DIM_Life_Claims_Details instead.
// It targets the dims' PRIMARY KEYS, both unique, so these are true one-to-many edges. Until
// 2026-08-28 they were drawn on SUB_CLAIM_ID -- only the first three of the key's five parts --
// which hit every dim row sharing a sub-claim and made a declared many-to-one behave
// many-to-MANY: 94 motor and 2,029 non-motor sub-claims occupy 2-3 dim rows because the dims split
// by risk policy and subject. Nothing in the tooling caught that, since both dims are correctly 🔑
// on their PK and the non-unique column was the one being joined.
// Both edges ARE tested in gold_models.yml, each SCOPED by the LOB encoded in RISK_ID, which
// partitions the column cleanly: of the rows RISK_ID calls MOTOR, 1,681,380 of 1,681,380 land in
// the motor dim and none in non-motor, and the mirror holds for 149,341 non-motor. Both tests
// pass. The 1,127 rows whose RISK_ID is null or neither fall outside both scopes and are the only
// part of this edge the suite does not cover -- they do resolve.
Ref FK_F_FCT_Claims_CLAIM_DETAIL_ID_MOTOR: "❌✂️🔑 F_FCT_Claims".CLAIM_DETAIL_ID > "✅✂️🔑 E_DIM_Motor_Claims_Details".MOTOR_CLAIM_DETAIL_ID
Ref FK_F_FCT_Claims_CLAIM_DETAIL_ID_NON_MOTOR: "❌✂️🔑 F_FCT_Claims".CLAIM_DETAIL_ID > "✅✂️🔑 E_DIM_Non_Motor_Claims_Details".NMOTOR_CLAIM_DETAIL_ID

// -> D_DIM_Treaty_Details
// The FK is named TREATY_ID, plainly, and so is the dimension's key: §4.7 asks the FK to carry
// the name of the key it targets, and 2026-08-28 freed that name. It was TREATY_NATIVE_ID on both
// sides only because D_DIM_Treaty_Details.TREATY_ID held the bare treaty number ('2') instead of
// the composite ('2|4|1'); that column is now TREATY_NUMBER, which is what it actually is.
// CARDINALITY 1 --> M, measured: the dim key is unique 1,770 / 1,770 -- and unique three
// independent ways (this key, LAYER_REINSURER_ID, and the natural treaty|layer|reinsurer triple),
// so there is no duplication anywhere on the one side. The many side carries 9,675,040 populated
// rows over 1,543 distinct participations and resolves 100%, 0 orphans.
// G_DIM_Reinsurance_Share.TREATY_LAYER_CODE is NOT a second edge: same domain as the dim's
// TREATY_NUMBER|LAYER_ID (208 of 227 values match) but only 246 combinations over 1,770 rows, so
// it is not unique there and an edge on it would behave many-to-many.
Ref FK_G_DIM_Reinsurance_Share_TREATY_ID: "✅✂️🔑 G_DIM_Reinsurance_Share".TREATY_ID > "✅✂️🔑 D_DIM_Treaty_Details".TREATY_ID

// -> F_FCT_Claims
// Named TRANSACTION_ID for the same reason. As CLAIM_ID it collided with F_FCT_Claims.CLAIM_ID,
// which is the TCS life-claim FK and a different thing entirely: a name-bind returned 0 rows while
// the declared edge resolved 99.96%. Renamed 2026-08-26.
Ref FK_G_DIM_Reinsurance_Share_TRANSACTION_ID: "✅✂️🔑 G_DIM_Reinsurance_Share".TRANSACTION_ID > "❌✂️🔑 F_FCT_Claims".TRANSACTION_ID

// Islands — declared by nothing:
//   A_DIM_Date
//   A_REF_Plan_Class
//   A_REF_Vehicle_Types
