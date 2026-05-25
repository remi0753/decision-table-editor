import { FileJson2, TerminalSquare } from 'lucide-react';
import { Callout, CodeBlock, DocSection } from '../components';

export function HostedApiPage() {
  return (
    <>
      <DocSection title="Endpoint">
        <p>
          Hosted API evaluates a logic through plain HTTP. Use it when another
          service needs a deterministic answer and you want a simple request and
          response contract. The endpoint is under <code>/v1</code>, uses Bearer
          API key authentication, and accepts JSON.
        </p>
        <CodeBlock
          title="Evaluate endpoint"
          code={`POST https://leverie.dev/v1/logics/{id}/evaluate`}
        />
        <p>
          The <code>{'{id}'}</code> segment identifies the logic. In examples we
          use a readable slug such as <code>loan-review</code>. The API key
          still gates access by workspace and allow-list scope.
        </p>
      </DocSection>

      <DocSection title="Request body">
        <p>
          Send inputs under the <code>inputs</code> property. Keys may be field
          names or field IDs. Field names are preferred for external callers
          because they keep payloads readable. Number and boolean strings are
          normalized by the server before evaluation.
        </p>
        <CodeBlock
          title="curl"
          code={`curl https://leverie.dev/v1/logics/loan-review/evaluate \\
  -H "Authorization: Bearer lvr_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -H "X-Request-Id: case-1098" \\
  -d '{
    "inputs": {
      "customerTier": "gold",
      "amount": 4200,
      "hasFraudSignal": false
    }
  }'`}
        />
        <Callout icon={TerminalSquare} title="Use request IDs">
          <code>X-Request-Id</code> is optional, but strongly recommended for
          production callers. It lets your logs and LEVERIE execution logs point
          to the same case.
        </Callout>
      </DocSection>

      <DocSection title="Response body">
        <p>
          A successful response includes logic metadata, version metadata, a
          result, a trace, request ID, and latency. Outputs are keyed by output
          column names. Trace entries avoid internal IDs and use names that a
          reviewer can understand.
        </p>
        <CodeBlock
          title="200 OK"
          code={`{
  "logic": {
    "id": "loan-review",
    "name": "Loan Review",
    "slug": "loan-review"
  },
  "version": {
    "type": "production",
    "number": 7
  },
  "result": {
    "status": "ok",
    "outputs": {
      "decision": "manual_review",
      "queue": "credit_ops"
    }
  },
  "trace": [
    {
      "table": "Initial review",
      "matchedRow": {
        "index": 3,
        "conclusion": "Manual review"
      },
      "skippedRows": [
        { "index": 1, "failedField": "amount" }
      ]
    }
  ],
  "requestId": "case-1098",
  "latencyMs": 18
}`}
        />
      </DocSection>

      <DocSection title="Version selection">
        <p>
          The default version is <code>production</code>. You can explicitly
          request <code>latest</code> or a numbered version such as
          <code>v7</code>. Drafts are rejected because drafts are mutable and
          may be internally inconsistent during authoring.
        </p>
        <CodeBlock
          title="Version query examples"
          code={`POST /v1/logics/loan-review/evaluate
POST /v1/logics/loan-review/evaluate?version=production
POST /v1/logics/loan-review/evaluate?version=latest
POST /v1/logics/loan-review/evaluate?version=v7`}
        />
      </DocSection>

      <DocSection title="Failure behavior">
        <p>
          Authentication failures return HTTP errors and do not evaluate logic.
          After authentication, invalid inputs or engine failures are logged as
          execution errors so operators can inspect what the caller attempted.
        </p>
        <Callout icon={FileJson2} title="No-match is a valid outcome">
          A no-match result means the request was valid, but no row matched the
          inputs. Treat it differently from HTTP errors and invalid input
          failures.
        </Callout>
      </DocSection>

      <DocSection title="OpenAPI spec">
        <p>
          The full machine-readable OpenAPI 3.1 specification for the{' '}
          <code>/v1</code> surface — Evaluate plus the hosted MCP endpoint — is
          served at a stable URL. Point SDK generators, Postman, Insomnia, or
          MCP catalogs at it.
        </p>
        <CodeBlock
          title="OpenAPI spec endpoint"
          code={`GET https://leverie.dev/v1/openapi.json`}
        />
        <p>
          The document is public and cacheable for one hour. It is regenerated
          on every deploy, so what you fetch always matches the live API.
        </p>
      </DocSection>
    </>
  );
}
