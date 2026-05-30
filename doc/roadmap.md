# LEVERIE Unimplemented Roadmap & Backlog

This document consolidates everything in LEVERIE that is **not yet implemented** — concepts, features, and improvements — in one place. It does not include the history of completed phases (P0–P4). For how to use the tool, see [leverie.dev/docs](https://leverie.dev/docs); for the already-built design, see [design_schema.md](design_schema.md) / [design_infrastructure.md](design_infrastructure.md).

## Table of contents

- [1. Vision & Strategy](#1-vision--strategy)
- [2. Roadmap (not-yet-started phases)](#2-roadmap-not-yet-started-phases)
- [3. Unimplemented backlog (design notes)](#3-unimplemented-backlog-design-notes)
  - [3.1 Advanced condition-validation engine](#31-advanced-condition-validation-engine)
  - [3.2 Review Runner (read-only Editor Shell)](#32-review-runner-read-only-editor-shell)
  - [3.3 Editing UX — future considerations](#33-editing-ux--future-considerations)
  - [3.4 UI/UX review — open items](#34-uiux-review--open-items)


---

## 1. Vision & Strategy

Status: draft (under ongoing discussion)

The vision for evolving LEVERIE from a "decision-table editor" into an "**LLM-native decision-logic platform**." This section covers only **the end state the product aims for, who it is for, and why it can win**. The execution plan and progress are in § 2 (Roadmap); the already-built platform foundation (multi-tenant, versioning, permissions, audit schema) is in [design_schema.md](design_schema.md).

> **Strategic core**: read § 1.1 (splitting "author" into two personas) and § 4 (the "Kenji" author persona) first. The recognition that LEVERIE's **long-term moat accrues only on the Author (Kenji) side, not the Installer (Maya) side** is the premise for every decision — phase strategy, UX investment, pricing model, taglines, etc.

### The value proposition

LEVERIE is not merely a tool to **edit logic**; it aims to create a state where, **starting from the implemented logic, humans, other systems, and LLMs can all use the same decision**.

### 1. Stakeholders

The moment an execution interface is exposed, users split into three kinds. The current starting point is a single author, but the design avoids bolting on the other two later.

| Role | Examples | Main concerns |
|---|---|---|
| **Author (the maker)** | Business analyst, rule designer, PdM | Editing experience, consistency checks, test cases |
| **Consumer (the user — person or machine)** | Operations staff, other systems, LLM agents | Stable interface, explainability, latency |
| **Owner (the administrator)** | Org admin, compliance officer | Permissions, audit logs, version management, billing |

#### 1.1 Splitting "author" into two personas (the strategic core)

Lumping "author" into a single persona leads to strategic error. In reality the **Installer** (adopter) and the **Author** (the person who keeps writing) are distinct personas, and LEVERIE only works as a business when both are satisfied.

| Sub-split | Examples | Position in LEVERIE |
|---|---|---|
| **Installer (adopter / technical bridge)** | Founding eng at an AI startup / SI vendor / in-house AI engineer | The technical decision-maker who handles MCP connection, cloud contracts, and logic migration. **The Phase 1 adopter (Maya)** |
| **Author (the one who keeps writing / strategic end-user)** | Contact-center SV, insurance underwriter, bank loan reviewer, compliance/operations analyst | Does not write code but owns the company's **operations manuals / rulebooks**. **Keeps revising** LEVERIE on a monthly cadence. The source of long-term retention (§ 4's Kenji) |

**Why this distinction matters:**

- The Installer can always fall back to Python / TypeScript. If LEVERIE isn't useful, they just leave
- The Author cannot **get their job done without LEVERIE** (they have no way to bridge from a paper manual to AI-agent execution)
- Therefore **LTV and moat accrue only on the Author side**. The Installer is a **distribution channel**, not a value recipient
- Conflate the two and you end up building "a handy developer tool for Maya" and nothing more, erasing differentiation from competitors (GoRules / Camunda)

The real path to winning is to make the experience of **"the Author writes the logic without ever seeing JSON, and the Installer wires it into the AI agent"** actually work.

#### 1.2 The Two-Track structure and phase strategy

Phases progress along two parallel tracks: the **Installer Track** and the **Author Track**. P0–P4 are implemented; P5–P6 are the remaining scope (details in § 2).

| Phase | Main track | Delivered to Installer (Maya) | Delivered to Author (Kenji) |
|---|---|---|---|
| **P0–P4** (implemented) | Foundation / Installer / Author | Core engine + schema generation, Standalone→Hosted MCP / API keys, Cloud Foundation | JSON-free editing UX, industry samples, intra-row contradiction warnings, cloud save / co-editing / versioning, edits reflected to LLMs in real time |
| **P5** (not started) | Both | Auditing & observability | Business-side accountability requirements (compliance, onboarding) |
| **P6** (not started) | Both | SDK / billing | Industry templates / Japanese localization / business-term aliasing |

**Strategic implications (still valid):**

1. **Investment in the editing UX is not polish but the core of moat formation** (remaining items in § 3.3 / § 3.4)
2. **The F-4 KPI (Author bridging = number of installs where someone other than the Installer opened the editor)** is the validation metric for the strategic hypothesis, auto-measured cloud-side from Phase 3

### 2. The differentiation core and the unimplemented surfaces

**The design crux**: because logic carries typed field definitions, the **input/output JSON Schema can be auto-generated**. Distributing it as an OpenAPI spec / MCP tool definition / LLM function-calling spec means **zero hand-written schema is needed for integration**. This is LEVERIE's biggest differentiator in the LLM era (implemented as Editor / Hosted API / Hosted MCP).

Remaining surfaces:

- **SDK (TS / Py)** — a thin wrapper over the above APIs (`leverie.logics("loan_review").evaluate({...})`). The Python SDK is in P6 scope (unimplemented)
- **Runner UI use case B (stakeholder-facing human-review surface)** — see § 2.1 below (unimplemented)

#### 2.1 Runner UI positioning (the unimplemented core)

The Runner UI easily conflates three use cases, so prioritize them explicitly. The execute-only Runner is implemented, but **use case B — the primary purpose, the review surface — is not implemented**.

| Use case | Main users | Position in LEVERIE | Status |
|---|---|---|---|
| **A. The author's own "production-feel" testing** | The author | Satisfied by the evaluation panel inside the editor | Implemented |
| **B. Stakeholder-facing human-review surface** (**primary purpose**) | Business managers, compliance, vendors | The surface where Kenji shares a URL and obtains agreement that "we'll hand this to the AI." **Value unique to LEVERIE that MCP / API absolutely cannot substitute** | **Unimplemented** (§ 3.2) |
| **C. Embedding in other systems (iframe / widget)** | Customers who embed the execution UI in another SaaS screen | A derivative of B (`?embed=1`). Once demand is visible | Future |

### 3. The human ↔ LLM bidirectional translation layer

LLM integration is not merely "publishing to LLMs"; it is designed as bidirectional translation where **what the Author wrote is directly readable by the LLM**. This is LEVERIE's unique position.

| Direction | Content | Status |
|---|---|---|
| **Author → LLM** (the differentiation core) | The rules Kenji wrote in tables become callable by the LLM as MCP tool definitions the moment they are edited. **No code translator is placed** between Kenji and the AI | Implemented (Hosted MCP) |
| **LLM → Author** (accountability) | The basis for the LLM's conclusion is returned as a trace Kenji can read ("which row matched") | Implemented (trace return) |

Bidirectional-translation elements that remain unimplemented:

- **Runner UI (use case B)** — formats the trace from an LLM tool call into a review space Kenji can show directly to a business-side manager (§ 2.1)
- **Dry-run / auto-generated sample inputs** — makes it easier for the LLM to learn the input format, and gives Kenji a handle on "how my rules get called"

The pitch is two-layered:

- **For Installers**: "Logic built in LEVERIE is instantly callable as an LLM tool" → "Build deterministic decision tools for AI agents — in tables, not code."
- **For Authors**: "Your business rules become the decision logic of an AI agent, as-is" → e.g. "Your team's policies — readable by humans, executable by AI." To be finalized after seeing reactions in candidate interviews

### 4. The strategic end-user persona: "Kenji"

The concrete persona of the Author (the one who keeps writing) introduced in § 1.1. The Installer persona Maya is the Phase 1 adopter; Kenji is the **strategic end-user** — a division of roles. Reaching Kenji's retention requires the not-yet-started P5 (audit, versioning, testing) and P6 (billing, localization, business terms), so this persona dictates the remaining development priorities.

#### 4.1 Basic profile

| Attribute | Detail |
|---|---|
| **Role** | Contact-center operations manager / insurance underwriting lead / bank loan-review team lead / EC customer-ops lead |
| **Company** | A business with 200–10,000 employees that has decided on or is rolling out AI chatbots / AI agents in 2026 |
| **Team** | An operations department of 5–30; 2–5 are involved in revising logic |
| **Technical background** | Proficient in Excel, Word, Notion. Some can read SQL but not write it. **Cannot touch JSON / YAML / Python.** Knows Git only by name |
| **Workload** | Existing manuals: 200–500 pages of Word + dozens of Excel sheets. Monthly revisions: 5–20. An annual full review |

#### 4.2 Kenji's real pain

The company has decided to adopt an AI chatbot, and the vendor said "**please structure your internal rules and hand them over**." What Kenji has on hand: a 200-page Word manual, an Excel routing flowchart (the visual kind made with merged cells), and tacit rules passed down by word of mouth.

- Revisions to Word / Excel are **untraceable** — who changed what, when
- Even told "hand it over as JSON," **JSON doesn't click**. IT replies "we can't understand it unless the business side writes it"
- Revisions are bound to the **vendor's release timing**, and meanwhile the AI runs on old rules

**The crux**: AI was adopted, yet Kenji is beginning to notice that **ownership of the rules has slipped away** from them.

#### 4.3 JTBD and the staged journey

> "I want to turn my rulebook into a form **the AI can read**, with my own hands, **without having it translated into code** — and have the **AI run on the new rules the instant** I revise them."

Secondary: **explainability** of past decisions (compliance, audit), **reduced dependence** on vendors / IT, and lighter onboarding load.

Kenji reaches this in stages: an **observer** in Phase 1, **someone who tries it themselves** in Phase 2 (JSON-free editing completed), and an **actual editor as part of the job** in Phase 3 (cloud save / sharing / co-editing). The moment three months in when they declare "**from now on I revise the AI's rules directly in LEVERIE**" = the true strategic win. That requires audit logs, versioning, and testing (P5), and billing based on "number of Authors × feature tier" (P6).

#### 4.4 What decides success at First Try

The moment Kenji first opens the editor:

1. **No JSON appears on screen at all** (the moment it does, they conclude "this isn't for me")
2. The samples look **just like** Kenji's work (customer-support routing / refund eligibility, etc.)
3. "Add a column and write a condition" feels **exactly like Excel** (§ 3.3)
4. "Once I save this, the AI can call it" is **understandable from a single screen of explanation**

#### 4.5 Kenji-side competition

What Kenji compares LEVERIE against is not GoRules or LangGraph but:

- **Competitor K-A**: the status quo — Word / Excel + asking the vendor to revise (**the strongest competitor**)
- **Competitor K-B**: big SaaS "no-code AI building" (Zendesk AI / Salesforce Einstein, etc.). LEVERIE wins on "not locked into a specific SaaS" and "logic portable as an artifact"
- **Competitor K-C**: vendor-specific rule-management screens. LEVERIE wins on "call the same logic from multiple AI products" and "keep it as a company asset"
- **Competitor K-D**: the business-side GUI of legacy BRMS (Drools / IBM ODM). LEVERIE wins on "designed for the LLM era" and "lightweight setup"

#### 4.6 Implications of Kenji's existence for product design (open items)

| Area | With Kenji in mind |
|---|---|
| Terminology | Japanese UI, business-term aliasing ("rule," "condition table," "item") — P6 |
| Error display | In business language: "**why it's a problem** + **how to fix it**" |
| Pricing boundary | Separate **the people who can edit (Author seat)** from **read / execute (Runner / Agent)**. Authors are few and high-priced, Runners / Agents free or low-priced — P6 |
| Runner UI | **The surface where Kenji shares a URL with business managers / compliance to reach agreement** (§ 2.1 use case B) — unimplemented |

#### 4.7 Validation plan for the Kenji hypothesis

- Interview **5 operations leads** at companies rolling out AI chatbots
- Questions: "How do you manage your manuals today?" "After AI adoption, who revises the rules?" "If you could **write in a table and have it reflected to the AI instantly**, what would change?"
- Verdict: if 3 of 5 say "**I'd want to write it myself / it would help if I could**," the hypothesis holds

### Related

- Not-yet-started phases (P5 / P6) → § 2
- Advanced condition-validation engine (unimplemented) → § 3.1
- Runner review surface (unimplemented) → § 3.2
- Editing UX remaining items → § 3.3 / § 3.4
- Schema of the already-built platform foundation → [design_schema.md](design_schema.md)

---

## 2. Roadmap (not-yet-started phases)

Last updated: 2026-05-30

This section manages LEVERIE's **remaining execution plan**. Because P0–P4 are implemented, their detailed task history is omitted; here we cover the **status overview** and the **not-yet-started P5 / P6**. For the product's end state, see § 1 (Vision & Strategy).

### Status overview

| Phase  | Name                         | Main track             | Status         | Tasks done |
| ------ | ---------------------------- | ---------------------- | -------------- | ---------- |
| **P0** | Headless Core                | Foundation             | ✅ Implemented | 7 / 7      |
| **P1** | Standalone MCP               | Installer              | ✅ Implemented | 7 / 7      |
| **P2** | Author UX                    | Author                 | ✅ Implemented | 3 / 3      |
| **P3** | Cloud Foundation + Runner UI | Author + Installer     | ✅ Implemented | 10 / 10    |
| **P4** | Hosted API / MCP             | Installer              | ✅ Implemented | 8 / 8      |
| **P5** | Trust & Ops                  | Author + Installer     | ⏸ Not started  | 0 / 6      |
| **P6** | Business                     | Author + Installer     | ⏸ Not started  | 0 / 6      |

Task size notation: **S** (1–3 days) / **M** (1–2 weeks) / **L** (2+ weeks).

> **What the implemented phases delivered**: core engine + JSON Schema generation (`@leverie/engine` / `@leverie/schema` / `@leverie/checks`), Standalone→Hosted MCP / Evaluate API / API keys, JSON-free Author editing UX, Cloud Foundation (org / workspace / membership / logic versioning / permissions), Runner UI (execute-only). For the persistence schema see [design_schema.md](design_schema.md); for infrastructure design see [design_infrastructure.md](design_infrastructure.md).

### Critical path

```
                    ┌─→ P1 (Installer) ─────────────→ P4 (Hosted API/MCP) ─┐
P0 [✅] ─→ (split) ─┤                                                          ├─→ P5 ─→ P6
                    └─→ P2 (Author UX) ─→ P3 (Cloud Foundation + Runner UI) ─┘
```

- P5 and P6 can run in parallel per feature

### KPI observation (F-1 – F-4)

Validation metrics for the strategic hypothesis. Auto-measured cloud-side from Phase 3.

| KPI                              | Measured                                                                          | Measurement starts |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------ |
| **F-1: GitHub stars 500+**       | Repository stars                                                                  | Right after P1 launch |
| **F-2: MCP 100+ monthly starts** | CLI / Docker pulls, opt-in telemetry                                              | Right after P1 launch |
| **F-3: 5+ external PRs**         | Merged PRs from external contributors                                             | Right after P1 launch |
| **F-4: Author bridging 20+/mo**  | Installs where "a user other than the Installer opened the editor" (the hypothesis core) | P3 (automatic) |

**Signal that F-4 is failing**: "letting PMs / business staff touch it" is rare → bring forward Author-facing UX investment, redesign samples, rewrite the Author tagline.

---

### Phase 5: Trust & Ops ⏸ Not started

**Position**: groundwork for the move to enterprise. The accountability / regression-detection foundation needed for Author (Kenji) retention (§ 1, "4.3 JTBD and the staged journey").

#### Tasks (0/6)

- [ ] **P5.1 (M)** Detailed execution logs — inputs/outputs, trace, caller, latency, retention policy
- [ ] **P5.2 (M)** Execution-log UI — filtering, drill-down
- [ ] **P5.3 (M)** Test-case persistence — saved per logic, execution history per version
- [ ] **P5.4 (S)** Pass-the-tests gate at publish time (optional)
- [ ] **P5.5 (M)** Webhooks — notify on publish, execution failure, specific conclusions
- [ ] **P5.6 (M)** Operations foundation — backups, monitoring, alerts, status page

---

### Phase 6: Business ⏸ Not started

**Position**: full-scale expansion into regulated industries, and monetization.

#### Tasks (0/6)

- [ ] **P6.1 (L)** Billing — Stripe, subscriptions, usage metering, overage (Author seat × feature tier)
- [ ] **P6.2 (M)** Python SDK
- [ ] **P6.3 (M)** SSO / SAML (Enterprise)
- [ ] **P6.4 (M)** Audit-log retention settings (Enterprise)
- [ ] **P6.5 (L)** Data residency (Enterprise)
- [ ] **P6.6 (L)** SOC 2 certification project

---

---

## 3. Unimplemented backlog (design notes)

Design notes for unimplemented features and improvements that do not carry a phase number.

### 3.1 Advanced condition-validation engine

Created: 2026-05-20
Status: proposal note

This note outlines the design direction for extending LEVERIE's decision-logic validation from the current `enum` / `bool`-centric coverage check toward more general condition validation including numbers, dates, and datetimes.

#### 1. Background

A key way LEVERIE differentiates from general-purpose workflow-automation tools like n8n is not merely executing logic, but **statically validating decision rules for gaps, omissions, duplicates, and unreachability**.

The current quality checks perform:

- Duplicate-row detection
- Unreachable-row detection
- Intra-row contradiction detection
- Coverage-gap detection centered on `enum` / `bool` types

But to fully validate arbitrary conditions including number, date, datetime, and string types, you cannot simply enumerate; you must treat conditions symbolically.

For numeric conditions, for example, you cannot enumerate all numbers to ask "is every number covered?" Instead you treat the set of values a condition represents as intervals and use set operations to find excess and shortfall.

#### 2. Basic approach

Treat each condition cell as a "set of values."

Numeric example:

```text
age >= 18        => [18, +∞)
age < 65         => (-∞, 65)
age between 1,5  => [1, 5]
age != 10        => (-∞, 10) ∪ (10, +∞)
empty cell       => (-∞, +∞)
```

`enum` example:

```text
plan = pro                    => {pro}
plan in [pro, enterprise]     => {pro, enterprise}
plan != free                  => all enum values - {free}
empty cell                    => all enum values
```

A single rule row is the AND of its column conditions, so it can be represented as a multidimensional region.

```text
age >= 18 AND plan = pro AND country in [JP, US]
```

This becomes the following product region.

```text
age: [18, +∞)
plan: {pro}
country: {JP, US}
```

Using this representation, decide mainly these three:

```text
Duplicate:
  region(rowA) == region(rowB)

Unreachable:
  region(rowB) ⊆ union of the regions of rows above rowB

Coverage gap:
  Universe - union of all rows is non-empty
```

Because LEVERIE uses first-match semantics, the unreachability check in particular is framed as:

```text
row i is reachable iff
  region(row i) - union(region(row 0..i-1)) is non-empty
```

If empty, that row is never reached for any input.

#### 3. The Domain abstraction

At the core of the validation engine, introduce a `Domain` abstraction that handles per-type value sets.

```ts
interface Domain<T> {
  isEmpty(): boolean;
  equals(other: Domain<T>): boolean;
  contains(other: Domain<T>): boolean; // this ⊇ other
  intersect(other: Domain<T>): Domain<T>;
  subtract(other: Domain<T>): Domain<T>[];
}
```

Each type has a concrete implementation.

| Domain | Representation | Main target |
|---|---|---|
| `BoolDomain` | bitset | `bool` |
| `EnumDomain` | bitset | `enum` |
| `NumberDomain` | interval union | `number` |
| `DateDomain` | interval union | `date` |
| `DatetimeDomain` | interval union | `datetime` |
| `StringDomain` | exact set / limited predicates | `string` |
| `NullabilityDomain` | nullable / non-null / null-only | `null` conditions |

A row is represented as a region with a `Domain` per field.

```ts
type RowRegion = Map<string, Domain<unknown>>;
```

An empty cell is treated as that field's universe domain.

#### 4. Implementation approach for the number type

For numbers, treat values as intervals rather than enumerating.

```ts
type Bound = {
  value: number | typeof NEG_INF | typeof POS_INF;
  inclusive: boolean;
};

type Interval = {
  lo: Bound;
  hi: Bound;
};

type NumberDomain = Interval[];
```

Examples:

```text
>= 10   => [10, +∞)
< 20    => (-∞, 20)
!= 5    => (-∞, 5) ∪ (5, +∞)
between [1, 10] => [1, 10]
```

The key is to normalize every operation result.

Normalization does the following.

- Sort intervals by lower bound
- Merge overlapping intervals
- Drop empty intervals
- Implement `contains` / `intersect` / `subtract` against the normal form

This makes one-dimensional numeric validation fairly precise.

#### 5. Multi-column conditions and region subtraction

Real decision tables span multiple columns, so you must handle multidimensional regions, not 1-D intervals.

Example:

```text
row1: age < 20,  plan = free
row2: age >= 20, plan = free
row3:             plan = pro
```

Here coverage is considered in the `age × plan` space.

A practical implementation keeps a list of uncovered regions and subtracts each row's region in order.

```ts
let uncovered: Region[] = [universeRegion];

for (const row of rows) {
  const region = rowToRegion(row);
  uncovered = uncovered.flatMap((u) => subtractRegion(u, region));
  if (uncovered.length > LIMIT) return summarizedResult;
}
```

`subtractRegion(A, B)` subtracts a box from a multidimensional box. With dimension `d`, one subtraction splits into up to roughly `2d` regions.

However, the region count grows with the number of rows, columns, and condition complexity, so the implementation must always set a limit.

```text
gap proven exactly
proven exact full coverage
too complex — summary only
partial validation — contains unsupported types/operators
```

The UI also clearly distinguishes the above states.

#### 6. Introducing field domain metadata

Treating the universe of numbers / dates / datetimes as `(-∞, +∞)` produces results that are hard to explain to business users.

So consider giving field definitions a business-relevant target range.

```ts
{
  name: "Age",
  type: "number",
  min: 0,
  max: 120,
  integer: true,
  required: true
}
```

This enables explanations like:

```text
The target range of Age, 0–120, is fully covered.
```

And coverage gaps can be presented within a concrete business range.

```text
There is no rule for Age in 0–17.
```

This metadata also helps the Author UX: it becomes a mechanism for the Author to declare "the input range possible in this business," not just a type definition.

#### 7. Handling the string type

Strings are hard to fully validate.

Including `contains` / `starts_with` / `ends_with` / regex-like conditions, subsumption / intersection / coverage decisions become suddenly complex.

So the initial implementation limits scope as follows.

| Operator | Approach |
|---|---|
| `=` | treat as an exact set |
| `!=` | treat as the complement of an exact set; limited if the universe is undefined |
| `in` | treat as an exact set |
| empty cell | treat as the universe |
| `contains` | not used for coverage proofs |
| `starts_with` | not used for coverage proofs |
| `ends_with` | not used for coverage proofs |

Some contradiction detection is still possible.

```text
name = "Alice" AND name != "Alice" => contradiction
```

In the future there is the option of converting string conditions to automata to decide subsumption / intersection, but the implementation cost is high and explanation to business users is hard, so its initial priority is low.

#### 8. The option of using an SMT solver

An advanced approach is to use an SMT solver such as Z3.

Convert each row into a logical formula.

```text
rowReachable(i) =
  rowCondition(i) AND NOT(rowCondition(0) OR ... OR rowCondition(i-1))
```

If satisfiable, the row is reachable; if unsat, unreachable.

Coverage can also be decided by:

```text
NOT(row1 OR row2 OR ... OR rowN)
```

If satisfiable there is a gap; if unsat, complete coverage.

However, depending on a solver from the initial implementation is not recommended.

Reasons:

- It may be heavy to run in the browser
- It is hard to translate the result back into an explanation for business users
- String theory is hard to handle
- It makes the engine harder to debug
- It easily becomes over-engineering relative to LEVERIE's core value

So implement a homegrown typed domain algebra first, and use a solver later as a cloud-side "detailed validation" feature.

#### 9. Proposed implementation steps

Introduce into `packages/checks` incrementally.

1. Build the `Domain` abstraction
2. Replace the existing coverage implementation with `BoolDomain` / `EnumDomain`
3. Implement `NumberDomain` as an interval union
4. Implement `DateDomain` / `DatetimeDomain` as interval unions
5. Build `cellToDomain(cell, fieldDef)`
6. Build `rowToRegion(row, table, fieldDefs)`
7. Replace unreachability detection with `rowRegion - previousUnion`
8. Replace coverage-gap with `universe - allRowsUnion`
9. Implement summary / partial result when the region count grows too large
10. Show "fully proven" / "partial validation" / "unsupported operators present" in the UI

#### 10. Classifying validation results

What matters as a product is not always returning a complete answer, but **honestly showing how far we can say something with certainty**.

Validation results are classified into at least the following.

| State | Meaning | Example UI message |
|---|---|---|
| `complete` | Validated all conditions exactly | All input patterns are covered |
| `gap_found` | Found an exact gap | There is no rule for this condition range |
| `unreachable_found` | Found an unreachable row | This row is fully covered by a row above it |
| `partial` | Validated while excluding some types/operators | Some string conditions are out of validation scope |
| `too_complex` | Region count exceeded the limit | Conditions are complex; showing a summary only |
| `unsupported` | Contains conditions that cannot be validated | This operator is not yet supported for coverage validation |

Key principles:

- Do not produce false positives
- Speak strongly only about what can be proven
- Say "not validated," with a reason, for what cannot be proven
- The more the business target range is defined, the stronger validation can be

#### 11. Strategic positioning in LEVERIE

This validation engine can be not just a quality-check feature but the core of LEVERIE's differentiation.

Even a workflow-automation tool like n8n can build some decision logic with IF / Switch / Code nodes. But that logic tends to scatter across the workflow graph, making it hard to statically prove:

- whether all business patterns are covered
- whether some rule is hidden behind a rule above it and becomes unreachable
- whether there is a hole in a numeric range
- whether an exception rule placed below a general rule is nullified
- whether it can be explained at a granularity business staff accept

LEVERIE treats decision logic not as part of a workflow but as an independent, verifiable artifact. The advanced condition-validation engine is the technical foundation that supports this stance.

#### 12. Recommended design philosophy

What LEVERIE needs is not a mathematically omnipotent theorem prover, but validation that business users can trust.

So the design philosophy is:

```text
Do not enumerate every value.
Compute the set a condition forms symbolically.
Widen, per type, the range that can be safely proven.
Honestly show what cannot be proven as "not validated."
```

This balances implementation feasibility with product value while growing LEVERIE's strength of "operating decision logic safely."

### 3.2 Review Runner (read-only Editor Shell)

Status: proposal (unimplemented)

> **Current state**: the execute-only Runner (`/run/<workspaceId>/<logicId>@vN` — a `packages/ui-runtime`-based input form + result + trace) is already implemented (P3 in § 2). The **Review Runner (a read-only Editor Shell) proposed here is not yet implemented**.

#### Background and intent

The Runner UI's primary purpose is not mere execution but a **human-review surface** where the Author hands a shared URL to a business manager / compliance / vendor to reach agreement on "may we hand this decision logic to an AI / external system?" (§ 1, "2.1 Runner UI positioning," use case B).

In that light, the implemented execute-only Runner (equivalent to the evaluation panel) is insufficient as a review experience. Reviewers want to see not only the result for an individual input but **the structure of the whole ruleset, its branches, its omissions, and the continue-reference relationships**.

#### Proposal: the Review Runner

Rather than a screen that isolates only the evaluation panel, design it around a **read-only mode that disables editing in the Editor UI**. Internally, reuse the Editor's shell / layout / visualization and hide editing actions based on permission or URL mode. To users, present it not as "an editor you can't edit" but as the **Review Runner / Stakeholder Review**.

What the review screen shows:

- Input form / evaluation result / execution trace
- The decision table
- The in-table flowchart
- The cross-table DAG
- Logic name, description, published version
- Quality-check warnings as needed

What the review screen disables:

- Editing the logic name / table names / field definitions / conditions / conclusions
- Adding, deleting, reordering rows / columns / tables / fields
- Import / publish / save / version creation / Undo / Redo

##### Why the execute-only Runner alone is weak

What the execute-only Runner tells you: "what is returned for this input," "which row matched," "where it hit no-match."

What the execute-only Runner makes hard to see:

- whether the whole rule structure matches business reality
- how other branches and exceptions are handled
- whether the relationship with continue-target tables is natural
- whether coverage gaps or unreachable rows are tolerable as business risk
- whether stakeholders accept this as logic to hand to AI / MCP / API

#### Mode breakdown and URLs

Emit multiple display modes from the same foundation. Execute-only is implemented, Review is unimplemented, Embed is future.

| Surface | Purpose | Main users | View definition | Execute | Edit | Status |
|---|---|---|---:|---:|---:|---|
| Editor | Create / revise logic | Author | Yes | Yes | Yes | Implemented |
| Review Runner | Stakeholder agreement | Managers, compliance, vendors | Yes | Yes | No | **Unimplemented** |
| Execute-only Runner | Execution only | Operations staff, external recipients | Optional / No | Yes | No | Implemented (P3.8) |
| Embed Runner | Embed in other systems | Other SaaS / customer screens | No or minimal | Yes | No | Future |

URL examples (a proposal to add `/review`):

| URL | Meaning |
|---|---|
| `/edit/<workspaceId>/<logicId>` | Author editing screen |
| `/review/<workspaceId>/<logicId>@vN` | Read-only review screen (**unimplemented**) |
| `/run/<workspaceId>/<logicId>@vN` | Execute-only screen (implemented) |

Whether to split `/review` and `/run`, or to distinguish by mode via `/run?view=review`, may be decided at implementation time. But as a product, "review" and "execute-only" are treated as different use cases.

#### Correspondence with the permission model

This fits well with the Viewer / Runner role split in the vision (§ 1). It is important not to always make the Runner role "definition-viewable" — there are cases where you want to grant LLM agents or external systems execution only without showing the contents, while for stakeholder review the definition view is precisely the value.

| Role | Recommended surface | Meaning |
|---|---|---|
| Editor | Editor | An Author seat that can edit |
| Viewer | Review Runner | Can read the definition but not edit |
| Runner | Execute-only Runner | Can execute only, without seeing the definition |

#### Implementation approach (if building the Review Runner)

- Reuse the already-implemented `packages/ui-runtime` as-is for the input form / result / trace.
- Introduce a capability / readonly mode into the Editor's UI components to control editing actions. Possible capabilities: `canEditLogicMetadata` / `canEditFields` / `canEditTables` / `canEditRows` / `canEditConditions` / `canEditConclusions` / `canReorderRows` / `canImport` / `canExport` / `canPublish` / `canRunEvaluation` / `canViewDefinition` / `canViewTrace`.
- In the Review Runner, only `canRunEvaluation` / `canViewDefinition` / `canViewTrace` are true.
- In read-only mode, **hide rather than disable** edit-only actions (add / delete / inline-edit affordances / drag handles / output-column management icons / import / publish). Keep table selection / table-flowchart toggle / DAG node-click navigation / trace-to-row jump / version display / share-link copy.
- The current layout that pins the evaluation panel to the right (P2.3) fits this direction, since it makes "run and try" and "see the whole ruleset" coexist.

#### Decision

Rather than ending the Runner UI as just "spinning out the evaluation panel," a **two-tier setup of a read-only Editor Shell (Review Runner) + an execute-only Runner** fits the value of the Author Track better. What Kenji wants to share with a business manager is not a mere execution form but a review space where they can be convinced "it's OK to hand this business rule to the AI."

### 3.3 Editing UX — future considerations

This note records ideas for Author-facing (non-engineer business user) editing-UX improvements that are **not yet implemented**.

> **Background**: the improvements deemed "high priority" in the 2026-05 editing-UX discussion (intra-row contradiction warnings / JSON-free field create-edit modal / revamped warning taxonomy and sticky left column / row-add workflow / icon-button standardization / sticky right action column / Undo / Redo / row duplication / a more-actions menu / inline `+` in column headers / first-launch empty-state CTA) are **all implemented** (Phase 2, see § 2). This note retains only the items deferred at that time as "medium priority (future considerations)."

#### Future considerations (medium priority)

Items that may add value alongside the above improvements but did not reach an implementation decision. After shipping the "high priority" changes, gather user feedback and prioritize by frequency × pain.

- Partial duplication over a column range (e.g. copy only the first N columns)
- Multi-row selection and bulk operations (delete / duplicate / move)
- Cell fill-down (copy the same value/condition vertically)
- Extended keyboard navigation (arrow keys between cells, Tab for horizontal movement, etc.)
- Keyboard shortcuts for row operations (⌘D to duplicate, Delete to remove) and a right-click context menu
- Find & replace
- Column reordering (drag)
- A "Load sample" button to explicitly load an educational sample logic

### 3.4 UI/UX review — open items

This retains the **not-yet-addressed** findings from a UX review of the LEVERIE editor done from a non-engineer (business user) perspective. The criterion is that a business user "understands what to do, can confidently edit rules, can verify behavior, and uses it without frustration."

> **Findings removed because they are addressed**: the evaluation panel stealing width during editing (solved by the right-pinned collapsible rail + splitting batch into a full-screen dialog = the Phase 2 evaluation-UX redesign), the staged first-launch empty-state CTA, inline `+` for adding rows/columns, sticky action / left-handle columns, the field create-edit modal, Undo/Redo, row duplication, icon-button standardization (also Phase 2). These include items recorded as "What Works Well" and "P0 evaluation panel."

#### Product premises

- The target is business / operations users working in a **desktop web browser**. Editing on mobile is out of scope.
- But even on desktop the window can become narrow (small laptops, non-maximized, split view). Phone-size editing optimization is unnecessary, but it must degrade without breaking at narrow widths.
- Placing the evaluation panel on the right is itself reasonable (input fields don't need wide width, and a bottom drawer looks sparse). The question is whether the state "out of the way while mostly editing the table, expand when testing" can be maintained.

#### High priority (open)

##### A minimum-support policy for narrow desktop / split windows

At very narrow widths, the fixed left pane + evaluation panel leave too little room for the table. Define a minimum support width, and below it either show a "wider window recommended" state or auto-collapse secondary panels. Prioritize a usable table editor over keeping all panels at once. Do not invest in phone optimization.

##### Step-by-step guidance for manual creation

The empty-state CTA is improved, but guidance after choosing "create from scratch" is still weak. The needed mental model is ① define fields → ② add condition columns → ③ assign fields to columns → ④ add rows → ⑤ edit conditions → ⑥ edit conclusions → ⑦ evaluate.

- Split the empty state into two paths: "start from a sample" and "create from scratch."
- For "create from scratch," guide with a small checklist (create input items → add condition columns → add rules → set results → test with sample input).
- When no fields exist, make "add the first condition column" either disabled with explanation or a redirect to field creation (currently it creates a `(none)` column and gives a "did I do something wrong?" feeling).

##### Header actions are too icon-only for first-timers

New / sample / batch test / import / export / Undo / Redo are icon-only (with tooltips). On desktop, add text labels to the important actions (especially "Samples," "Test," "Export"). Undo/Redo may stay icon-only to save space.

##### Context protection during horizontal scroll (pin the conclusion column)

The action / left-handle columns are sticky, but the **conclusion column** is not pinned, so it becomes hard to see as columns grow / the evaluation panel opens. Since the conclusion is the purpose of each rule, consider a freeze pane for the conclusion column (and the row-number column) so "condition → conclusion" can be compared without fighting horizontal scroll. A density control for large tables is also a candidate.

#### Medium priority (open)

##### Terminology is accurate but too technical

Lean the UI toward business language (the data model / docs may keep precise terms). Japanese localization / business-term aliasing is in P6 scope (§ 2).

| Current term | Friendlier UI direction |
| --- | --- |
| Field Definitions | Input items |
| Terminal conclusion | Final result |
| Continue reference | Continue to another table |
| Entry | Start table |
| Wildcard | No condition |
| Flowchart phantom node | Missing rule |

##### Confidence in condition-cell editing

Of "Set / No condition (wildcard)," "wildcard" is jargon, and the action amounts to removing the condition. Rename the button to "Remove condition / Match any value," and add a short note in the editor ("No condition = this input matches any value"). Validate required values before saving (e.g. don't save `=` with no enum selected).

##### Room for editing conclusions

Conclusion outputs are single-line inputs. In practice they tend to be multi-line — instructions, reasons, messages, escalation notes. Use a textarea for output columns that may hold long text. In the future, give output columns a type/display preference and improve in-table summary previews / tooltips.

##### Discoverability of field deletion

Deletion is hover-only, hard to discover and awkward on touch (the edit modal is already introduced). Show a persistent compact menu per field, or reveal edit/delete when the detail panel is expanded. Keep destructive confirmation and "block while in use."

##### The flowchart is small and hard to read

Useful for grasping structure, but with realistic samples the text is small and uncomfortable as a review surface. Add full-screen display, improve initial zoom (labels readable by default), make a node click clearly jump to and highlight the source row, and use "missing rule" wording for coverage gaps.

##### Batch-test step guidance

The dialog + edit path from a failing case is already introduced. Add a short step list (① download template → ② fill in Excel → ③ load CSV → ④ run all and inspect failures) and an explanation of the example row / expected-value columns before download.

#### Low priority (polish, open)

- **Initial generated names stay English after a language switch**: "New Logic" / "Table 1" are data, so they aren't translated. Regenerate the untouched default names on first run only, or follow the browser locale for the initial language, etc.
- **The DAG graph takes space even with a single table**: collapse by default until there are multiple tables, or show a simple "Start table: Table 1" summary for single-table logics.
- **Output-column management is hard to discover**: the settings icon in the conclusion header is small. Put a "Manage result fields" link in the conclusion editor, or label output columns clearly in the header.

#### Recommended roadmap (open items)

1. **Layout and first use**: define a minimum support width and auto-collapse secondary panels, strengthen manual-creation guidance, improve discoverability of primary header actions, freeze the conclusion column.
2. **Editing confidence**: business-language terms, condition-editor copy and validation, long-output support, discoverability of field / output-column management.
3. **Review and debugging**: full-screen flowchart, coverage / missing-rule wording, batch-test onboarding, deeper trace-to-row navigation.

#### Product principle

The table editor is the main stage. Supporting tools — evaluation, flowchart, field definitions, batch tests — should help users understand and verify the table without visually overpowering it. When in doubt, prefer "more table space," "clear business language," "show the next step," "reversible actions," and "examples before abstractions."
