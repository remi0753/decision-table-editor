# LEVERIE — Design & Specification Documents

This directory holds **contributor / maintainer-facing** design and specification material: the authoritative specs that the implementation and tests rely on, plus internal design that is not published on the user-facing docs site.

- **How to use the tool** is documented at **[leverie.dev/docs](https://leverie.dev/docs)**.
- **The concept and a developer-facing overview** live in the repository root [README.md](../README.md).

## Behavioral specifications (the `@leverie/*` package contracts)

The authoritative definitions that the evaluation engine, quality checks, and schema generation must implement. When you change behavior, update these documents together with the tests.

| File | Contents |
| --- | --- |
| [spec_data_model.md](spec_data_model.md) | Data model (the persisted JSON format and the field spec of each object) |
| [spec_field_types.md](spec_field_types.md) | Field types and condition operators — catalog and storage format |
| [spec_evaluation.md](spec_evaluation.md) | Evaluation model (execution algorithm, type coercion, trace, return values) |
| [spec_quality_checks.md](spec_quality_checks.md) | Quality checks (duplicate detection, unreachable rows, coverage, etc.) |

## Cloud Foundation design

| File | Contents |
| --- | --- |
| [design_schema.md](design_schema.md) | Cloud Foundation data model / DB schema design (tenant isolation, migration policy, etc.) |
| [design_infrastructure.md](design_infrastructure.md) | Cloud Foundation infrastructure design (hosting, auth, jobs, secrets, monitoring, CI/CD, etc.) |

## Vision, roadmap & unimplemented backlog

The product's end state and everything not yet implemented — concepts, features, and improvements — consolidated into a single file (it does not include the history of completed phases).

| File | Contents |
| --- | --- |
| [roadmap.md](roadmap.md) | ① Vision & strategy (end state, Two-Track, the "Kenji" author persona), ② not-yet-started phases (P5 Trust & Ops / P6 Business), ③ unimplemented backlog (advanced condition-validation engine / Review Runner / editing UX / UI/UX review) |
