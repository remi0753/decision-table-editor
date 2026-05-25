# LEVERIE examples

Three ready-to-run decision logics that demonstrate the kind of tools LEVERIE exposes through Hosted MCP after import and publish. Each file can become one MCP tool with full input schemas, output schemas, and execution traces.

Each file is a valid Logic JSON v2 — open it in the [LEVERIE editor](../) to see the tables and rules as a grid, then publish it to expose it from the hosted `/v1/mcp` endpoint.

## The samples

| File | Tool name | What it shows |
|---|---|---|
| [`loan-review.json`](./loan-review.json) | `loan_review` | Single table mixing **enum + number + bool**. Five rules covering corporate loans, individual loans with a guarantor, and individual loans without one. |
| [`support-ticket-routing.json`](./support-ticket-routing.json) | `support_ticket_routing` | **Three-table chain** via `continue` conclusions. Triage decides whether to escalate (outage check) or fall through to standard routing (category dispatch). |
| [`refund-eligibility.json`](./refund-eligibility.json) | `refund_eligibility` | Multi-condition policy: damage override → category blocks → standard window → loyalty extension → partial refund with restocking fee → reject. Uses `=`, `<=`, `>`, `between`, and `in` operators. |

## Try it from an LLM

After importing and publishing the examples, ask your MCP client to call the hosted tools:

### Loan Review

> *"Use the `loan_review` tool to decide whether a Corp customer requesting 5,500,000 with no guarantor should be approved."*

Expected verdict: `Manual review` — *"Corporate loan above 5,000,000 needs senior approval"*.

> *"What about an Individual customer requesting 800,000 with a guarantor on file?"*

Expected: `Approve` — *"Individual loan within guarantor coverage"*.

### Support Ticket Routing

> *"A P0 ticket just came in from an enterprise customer reporting a production outage. Use `support_ticket_routing` to route it."*

Expected: `Page on-call engineer`, SLA `15 minutes`. The returned `trace` will show **two steps**: `Triage` (row 1, `continue → Escalation`) then `Escalation` (row 1, terminal).

> *"And a P2 billing question from a free-tier user?"*

Expected: `Billing team`, SLA `1 business day` — trace goes `Triage → Standard Routing`.

### Refund Eligibility

> *"A standard-tier customer wants to return a $50 consumables order placed 40 days ago. Run `refund_eligibility`."*

Expected: `Reject` — *"Consumables non-refundable after 7 days"*.

> *"A gold-tier customer wants to return a $150 electronics order placed 20 days ago — not damaged."*

Expected: `Approve` — *"Loyalty tier: extended 30-day window"*. The trace shows four skipped rows before row 5 matches, with `failedField` annotations explaining each skip.

## Smoke-testing without an LLM

You can drive the hosted endpoint directly over JSON-RPC to confirm the same verdicts:

```bash
curl https://leverie.dev/v1/mcp \
  -H "Authorization: Bearer lvr_your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "support_ticket_routing",
      "arguments": {
        "Priority": "P0",
        "Customer Tier": "enterprise",
        "Has Outage": true
      }
    }
  }'
```

The `structuredContent` in the response contains the final outputs (`Queue`, `SLA`) plus the trace.

## Editing or remixing

Open any of these files in the [LEVERIE editor](../) via **Import** to inspect them visually, tweak the rules, save to a workspace, and publish a new production version. Hosted MCP serves the current production pin for each scoped API key.
