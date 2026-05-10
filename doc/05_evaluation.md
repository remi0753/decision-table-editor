# 5. 評価モデル（実行アルゴリズム）

## 5.1 評価の開始

1. ユーザーが入力コンテキスト `inputs`（フィールドIDをキー、入力値をバリューとするマップ）を指定する。
2. `entryTableId` のテーブルから評価を開始する。

## 5.2 テーブルの評価

評価は `evaluateTable(tableId, inputs, previousTrace, depth)` を再帰的に呼び出すことで実行される。詳細な実装（トレース収集込み）は §5.3 に記載する。以下は概念的な概要：

```
MAX_DEPTH = 50  // 継続参照の最大ネスト深度。破損データによる無限ループの安全弁

evaluateTable(tableId, inputs, previousTrace = [], depth = 0):
  // 深度ガード: インポートした破損データに循環参照が残っていた場合のフェイルセーフ
  if depth > MAX_DEPTH:
    return { status: "no_match", tableId: tableId, trace: previousTrace }
  table = tables[tableId]
  for each row in table.rows (上から順):
    if rowMatches(row, table.cols, inputs):
      if row.conclusion.type == "terminal":
        return { status: "ok", outputs: row.conclusion.outputs, trace: [...previousTrace, stepTrace] }
      if row.conclusion.type == "continue":
        return evaluateTable(row.conclusion.tableId, inputs, [...previousTrace, stepTrace], depth + 1)
  return { status: "no_match", tableId: tableId, trace: [...previousTrace, stepTrace] }
```

> **関数シグネチャ**: `evaluateTable(tableId, inputs, previousTrace, depth)` の4引数。
>
> - `previousTrace` は評価開始時に空配列 `[]` を渡す
> - `depth` は評価開始時に `0` を渡す（エントリーテーブル）。継続参照のたびに `depth + 1` で再帰する
> - §5.1 からの呼び出し: `evaluateTable(entryTableId, inputs, [], 0)`
> - 循環参照はデータ登録時に §6.1 で防止されるが、インポート破損データへの安全弁として `depth > MAX_DEPTH` で強制終了する。`MAX_DEPTH = 50` はロジックとして現実的に必要な継続参照の深さの上限値として設定している

## 5.3 行のマッチ判定

```
rowMatches(row, cols, inputs):
  // 返却値: { matched: bool, failedColId: string | null }
  // failedColId はトレース収集用。cols 配列を左から右（定義順）に評価し、
  // 条件セルが存在し（ワイルドカードでなく）かつ fieldId が null でない列の中で、
  // 最初にマッチしなかった列のIDを返す。すべてワイルドカードの場合は null。
  // ※ failedColId が null となるのは matched: true の場合のみ。
  //   matched: false のときは必ず失敗した列のID（string）が返る。
  //   よって skippedRows に追加されるエントリの failedColId は常に非 null。
  for each col in cols:
    cell = row.cells[col.id]
    if cell is undefined: continue  // ワイルドカード
    if col.fieldId is null: continue  // フィールド未選択列はスキップ（下記注記参照）
    input = inputs[col.fieldId]
    if NOT cellMatches(cell, input, fieldDefs[col.fieldId]):
      return { matched: false, failedColId: col.id }
  return { matched: true, failedColId: null }
```

> **`fieldId == null` 列の扱い（設計意図）**: `fieldId` が未設定の条件列は評価時に**ワイルドカードと等価**として扱い、その列の条件セルの内容に関わらずスキップする。これは「フィールドが未選択の列は条件として機能しない」という設計上の意図であり、仕様通りの挙動である。
>
> **全列が `fieldId == null` の行**: 行のすべての条件列が未選択の場合、その行はどんな入力に対しても `matched: true` を返す（デフォルト行と等価になる）。これも意図した挙動であるが、ユーザーが気づかずにこの状態を作ってしまう恐れがある。UIでは、条件セルが設定されているにもかかわらず `fieldId == null` の列に属するセルがある場合、そのセルに「フィールド未選択のため無効」という警告表示を行い、ユーザーがフィールドを選択するよう促す。

`evaluateTable` は `rowMatches` の結果を以下のように使用する:

```
evaluateTable(tableId, inputs, previousTrace, depth):
  table     = tables[tableId]
  stepTrace = { tableId, tableName: table.name, depth, matchedRowId: null, skippedRows: [] }

  for each row in table.rows:
    result = rowMatches(row, table.cols, inputs)
    if result.matched:
      // マッチした行は matchedRowId に記録する。skippedRows には含めない。
      // continue 行も含め、「マッチした行」は必ず matchedRowId に設定する。
      stepTrace.matchedRowId = row.id
      if row.conclusion.type == "terminal":
        return { status: "ok", outputs: row.conclusion.outputs,
                 trace: [...previousTrace, stepTrace] }
      if row.conclusion.type == "continue":
        // このテーブルの stepTrace を previousTrace に追加し、次テーブルへ
        return evaluateTable(row.conclusion.tableId, inputs,
                             [...previousTrace, stepTrace], depth + 1)
    else:
      // マッチしなかった行のみ skippedRows に記録する
      stepTrace.skippedRows.push({ rowId: row.id, failedColId: result.failedColId })

  // このテーブルでどの行にもマッチしなかった
  return { status: "no_match", tableId,
           trace: [...previousTrace, stepTrace] }
```

## 5.4 セルのマッチ判定

```
cellMatches(cell, input, field):
  op  = cell.op
  val = cell.val   // スカラーまたは string[]（between・in の場合）
  a   = coerce(input, field.type)

  // null 演算子は coerce 後の値が null かどうかで判定する（型に関わらず全型で有効）
  if op == "null":
    return a == null

  // null 演算子以外は、入力値が null（未入力・型変換失敗）なら常に false
  if a == null:
    return false

  // between・in は val が配列のため coerce を要素単位で適用する
  if op == "between":
    lo = coerce(val[0], field.type)
    hi = coerce(val[1], field.type)
    if lo == null or hi == null: return false   // 不正な範囲値
    if cmp(lo) > cmp(hi): return false          // lo > hi は UI で防止するが、評価エンジン側でも防御的に false を返す
    return cmp(lo) <= cmp(a) <= cmp(hi)   // cmp() は下記参照

  if op == "in":
    bs = val.map(v => coerce(v, field.type)).filter(b => b != null)  // coerce失敗値（破損データ）を除外
    if bs is empty: return false   // 有効な比較値が0件（保存データが全て不正）
    return bs.some(b => cmp(a) == cmp(b))

  // 値を持たない日付比較演算子（val不要のためここで先に処理する。b の coerce は不要）
  if op == "before_today":    return cmp(a) <  cmp(today())
  if op == "today_or_before": return cmp(a) <= cmp(today())
  if op == "after_today":     return cmp(a) >  cmp(today())
  if op == "today_or_after":  return cmp(a) >= cmp(today())

  // スカラー演算子（val が必要。coerce 失敗時は false を返す）
  b = coerce(val, field.type)
  if b == null: return false   // 保存値が不正（破損データなど）

  switch op:
    "="              → cmp(a) == cmp(b)
    "!="             → cmp(a) != cmp(b)
    "<"              → cmp(a) <  cmp(b)
    "<="             → cmp(a) <= cmp(b)
    ">"              → cmp(a) >  cmp(b)
    ">="             → cmp(a) >= cmp(b)
    "contains"       → String(a).includes(String(b))
    "starts_with"    → String(a).startsWith(String(b))
    "ends_with"      → String(a).endsWith(String(b))
    default          → false   // 未知の演算子（インポートデータの破損・将来の拡張版からの読み込みなど）
```

> **`switch op` の `default` 挙動**: 仕様で定義されていない演算子文字列が `op` に入った場合は `false` を返す（クラッシュしない）。これによりインポートした破損データや将来バージョンで追加された演算子を含むファイルを読み込んでも、その条件セルは「マッチしない」として安全に処理される。
>
> **`null` 演算子の適用対象**: 全型（`string`・`number`・`bool`・`enum`・`date`・`datetime`）で利用可能。上記の擬似コードに示すとおり、`null` 演算子は他の演算子より先に評価し、`coerce` 後の値が `null` であれば `true` を返す。
> `null` 演算子以外では、`coerce` が `null` を返した場合（未入力・型変換失敗）は早期リターンで **`false`** を返す。

### `cmp(v)` — 比較可能な値への変換

```
cmp(v):
  v が Date オブジェクト → v.getTime()   // date・datetime 型
  それ以外               → v             // number・string・bool・enum はそのまま
```

`date`・`datetime` 型は `coerce` が `Date` オブジェクトを返すため、`cmp()` で `.getTime()`（エポックミリ秒）に変換してから比較する。これによりタイムゾーン込みの値も正しく大小比較できる。

### `today()` — 現在日付の取得

```
today():
  d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // 当日の 00:00:00.000（ローカル時刻）を返す Date オブジェクト
  // cmp(today()) はその日の開始エポックミリ秒になる
```

`date` 型入力 `"2024-04-01"` は `parseDate` により `new Date("2024-04-01T00:00:00")`（ローカル 00:00:00）となる。`today_or_before` の境界条件: 当日の入力は `cmp(a) == cmp(today())` となり `<=` で真と判定される（当日を含む）。

## 5.5 型強制（coerce）

**フィールドの型を最優先**して変換する。入力値の形式（数値文字列か否か）より型定義を優先することで、`string` 型フィールドの値 `"123"` が数値 `123` として誤評価されることを防ぐ。

```
coerce(s, fieldType):
  // 第1段階: 空文字列・null チェックを他の型変換より優先する
  s == null または s === ""  → null
  // 第2段階: フィールド型に従って変換
  fieldType == "number"      → Number(s)（NaN の場合は null）
  fieldType == "bool"        → s === "true" ? true : s === "false" ? false : null
  fieldType == "date"        → parseDate(s)（無効な日付文字列の場合は null）
  fieldType == "datetime"    → parseDateTime(s)（無効な場合は null）
  fieldType == "enum"        → s（文字列のまま）
  fieldType == "string"      → s（文字列のまま）
  それ以外（"any"等）        → s（文字列のまま）

parseDate(s):
  new Date(s + "T00:00:00")（ローカルタイムゾーンとして扱う）
  Invalid Date → null

parseDateTime(s):
  // 必須: YYYY-MM-DDTHH:mm:ss、オプション: .SSS とタイムゾーン
  // 正規表現: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/
  // ミリ秒部分は 1〜3桁（.S / .SS / .SSS）を受け入れる。4桁以上は不正とする。
  if s does not match the pattern → null
  new Date(s)  // ブラウザの Date コンストラクタに委譲
  Invalid Date → null
  // タイムゾーンなしの場合はローカル時刻として解釈される
  // タイムゾーンあり（Z / +HH:mm / -HH:mm）の場合はUTCに変換されて保持される
  // 比較時は .getTime()（エポックミリ秒）で統一的に大小比較を行う
```

## 5.6 評価の終了条件と返却値

評価は以下のいずれかで終了し、トレース情報を必ず返す。

| 終了条件                             | 返却値                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| 終端結論（Terminal）の行にマッチした | `{ status: "ok", outputs: { [outputColId]: string }, trace: TraceStep[] }` |
| どの行にもマッチしなかった           | `{ status: "no_match", tableId: string, trace: TraceStep[] }`              |

`TraceStep` の構造:

```ts
{
  tableId: string,       // 評価したテーブルのID
  tableName: string,     // テーブルの表示名
  depth: number,         // 評価の深さ（0 = エントリーテーブル、1以上 = 継続参照先）
  matchedRowId: string | null,  // マッチした行のID（null = NO_MATCH）
  skippedRows: {         // マッチしなかった行とその理由
    rowId: string,
    failedColId: string  // 最初に一致しなかった列のID（cols配列の定義順）
                         // ※ skippedRows に入るのは matched:false の行のみであり、
                         //   その場合 failedColId は常に非 null の string
  }[]
}
```

`depth` フィールドはエントリーテーブル（`depth == 0`）か継続参照先（`depth >= 1`）かをUIが判定するために使用する。NO_MATCH メッセージ出し分けのための判定フラグである（[09_debug_trace.md](09_debug_trace.md) 参照）。

`NO_MATCH` 時もトレース情報を含めることで、どのテーブルのどの行で詰まったかを明示できる。

循環参照はデータ登録時に防止されるため（[06_quality_checks.md §6.1](06_quality_checks.md) 参照）、評価中に無限ループが発生することはない。
