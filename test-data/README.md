# Test Data

Manual verification data for the decision table editor. Each subdirectory contains a self-contained test case.

## Directory Structure

```
test-data/
├── tc01-basic-field-types/
│   ├── logic.json       # importable logic definition
│   └── batch.csv        # batch evaluation test cases
├── tc02-all-operators/
│   ├── logic.json
│   └── batch.csv
├── tc03-multi-table-chain/
│   ├── logic.json
│   └── batch.csv
├── tc04-quality-duplicates/
│   └── logic.json       # no batch.csv — UI-only test
├── tc05-quality-unreachable/
│   ├── logic.json
│   └── batch.csv
├── tc06-quality-no-default/
│   ├── logic.json
│   └── batch.csv
├── tc07-coverage-check/
│   └── logic.json       # no batch.csv — UI-only test
├── tc08-date-operators/
│   ├── logic.json
│   └── batch.csv
├── tc09-real-world-insurance/
│   ├── logic.json
│   └── batch.csv
└── tc10-auto-repair/
    └── logic.json       # no batch.csv — import repair test
```

## Usage

### Importing a logic file

1. Open the editor and click **インポート**
2. Select `logic.json` from the desired test case directory
3. The logic loads immediately — no page reload needed

### Running batch evaluation

1. Import a `logic.json` that has a corresponding `batch.csv`
2. Open the **評価** panel and switch to the **バッチ評価** tab
3. Click **CSVを読み込む** and select the `batch.csv` file
4. Click **すべて評価実行** to run all test cases
5. Rows marked ✓ pass; rows marked ✗ show the mismatch between expected and actual output
6. Click any row to expand the evaluation trace

---

## Test Case Reference

### TC-01: Basic Field Types

**Purpose**: Verify all six field types (number, string, bool, enum, date, datetime) render correct cell editors and evaluate correctly.

**Logic**: 1 table, 5 rules, 6 fields — 年齢, 氏名, 会員フラグ, プラン, 登録日, 最終ログイン

**Batch CSV**: 9 cases covering all reachable rules including the default row.

> **Note**: r4 (新規ユーザー日付条件) is only reachable when 会員フラグ=false, because r3 catches all true members first (first-match semantics).

---

### TC-02: All Operators

**Purpose**: Verify every condition operator: `=`, `!=`, `<`, `<=`, `>`, `>=`, `between`, `in`, `contains`, `starts_with`, `ends_with`, `null`.

**Logic**: 1 table, 25 rules, 5 fields — スコア, メモ, 有効フラグ, ステータス, 申請日

**Batch CSV**: 4 cases (only 4 rules are reachable in practice).

> **Unreachable rows discovered**: r2 uses `number: != 0`, which matches every non-zero score. This means r3–r7 (which also require non-zero scores with tighter bounds) are never reached. Only r1 (`= 100`), r2 (`!= 0`), r3 (`< 50` — only reached when score = 0), and r8 (`null`) are reachable. The table is intentionally kept as-is since its purpose is demonstrating operator syntax, not optimized rule coverage.

---

### TC-03: Multi-Table Chain

**Purpose**: Verify multi-table chaining — input context is passed through, and evaluation traces show each table visited.

**Logic**: 4 tables (申請振り分け → 新規審査 | 更新審査 | 解約処理), 4 fields — 申請種別, 契約年数, 延滞歴あり, 解約理由

**Batch CSV**: 11 cases covering all branches: 新規 (3 variants), 更新 (3 variants), 解約 (4 reasons), and the default fallback.

---

### TC-04: Quality Check — Duplicate Rows

**Purpose**: Verify the UI displays duplicate-row warnings on the correct rows.

**Logic**: 1 table, 6 rules — r1≡r3 and r2≡r4 are exact duplicates.

**No batch CSV** — this test is about visual warning indicators in the table editor, not evaluation output.

---

### TC-05: Quality Check — Unreachable Rows

**Purpose**: Verify the UI marks unreachable rows correctly and that first-match semantics produce the expected evaluation outputs.

**Logic**: 1 table, 7 rules, 2 fields — 地域, 優先度. r1 (地域=東京, 優先度=wildcard) subsumes r2 and r3.

**Batch CSV**: 7 cases demonstrating that 東京+high and 東京+low still match r1 (not r2/r3), confirming first-match behavior.

---

### TC-06: Quality Check — No Default Row

**Purpose**: Verify that inputs not covered by any rule produce `no_match`, and that the quality panel warns about the missing default row.

**Logic**: 1 table, 8 rules, 2 fields — 商品カテゴリ, 注文金額. No wildcard/catch-all row.

**Batch CSV**: 12 cases — 8 matching cases and 4 explicit `no_match` cases (衣類, 電化製品<10000, 食品金額未入力, 電化製品金額未入力).

---

### TC-07: Coverage Check (enum/bool)

**Purpose**: Verify that the coverage checker detects uncovered enum × bool combinations.

**Logic**: 1 table, 3 fields — 地域 (3 values), プラン (3 values), 本人確認済 (bool). 18 possible combinations, only 6 covered.

**No batch CSV** — this test is about the coverage check UI panel displaying uncovered combinations, not evaluation output.

---

### TC-08: Date Operators

**Purpose**: Verify relative date operators (`before_today`, `today_or_before`, `after_today`, `today_or_after`) and absolute date comparisons.

**Logic**: 2 tables. t1 = 有効期限確認 (entry table). t2 = 申請日時確認.

**Batch CSV**: 6 cases. Fixed-date cases have expected values (e.g., 2020-01-01 → 期限切れ, 2099-12-31 → 有効). The relative-date case (本日日付) is included without expected values so it always runs without failing regardless of execution date.

> **Note**: t2 is not reachable from t1 (t1 has only terminal conclusions, no `continue` rules), so t2's datetime rows are excluded from the batch CSV.

---

### TC-09: Real-World Insurance Claims

**Purpose**: End-to-end verification of a realistic multi-table routing logic with many output columns.

**Logic**: 3 tables — t1 受付振り分け → t2 高額査定 | t3 一般査定. 7 input fields, 9 output columns.

**Batch CSV**: 10 cases covering all paths: 免責期間内 (immediate reject), 死亡 (2 variants), 後遺障害, 医療費 (4 amount tiers), 入院, and the default fallback.

> **Note**: The output column 査定結果 appears in both t2 and t3, but with different values. The batch CSV uses only the unique output columns per table (受付結果 for t1, 支払限度額/必要書類 for t2, 支払金額/備考 for t3) to avoid ambiguity from duplicate column names.

---

### TC-10: Import Auto-Repair

**Purpose**: Verify that the importer detects and repairs invalid logic — broken `continue` references and tables with zero output columns.

**Logic**: 2 tables — t1 references non-existent `t999` in r2; t2 has an empty `outputCols` array.

**No batch CSV** — this test is about the import flow showing a repair notification toast, not evaluation output. After import, standard single evaluation is sufficient to confirm the repaired state.

---

## Batch CSV Format

Each `batch.csv` follows this structure:

```
ケース名,<field display name>,...,期待:<output col name>,...
<case name>,<input value>,...,<expected output value>,...
```

- **Encoding**: UTF-8 with BOM (opens correctly in Excel without a manual import step)
- **Input values**: Match the field's display name in the header; leave blank to omit (treated as null)
- **Expected values**: Leave blank to skip comparison for that column
- **Case name**: Free text; used as a label in the results table

Download a pre-filled template from the **バッチ評価** tab → **テンプレートCSVをダウンロード** after importing any `logic.json`.
