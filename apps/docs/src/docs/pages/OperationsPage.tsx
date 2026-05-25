import { Cloud, FileJson2, Gauge } from 'lucide-react';
import { Checklist, CodeBlock, DocSection, FeatureGrid } from '../components';

const errorRows = [
  ['missing_authorization', '401', 'Authorization header was not provided.'],
  ['invalid_authorization', '401', 'Header is not in Bearer token format.'],
  [
    'invalid_api_key',
    '401',
    'The key is malformed, revoked, or cannot be verified.',
  ],
  ['logic_not_in_scope', '403', 'The key does not allow this logic.'],
  [
    'logic_not_found',
    '404',
    'No accessible logic exists for the requested id.',
  ],
  [
    'invalid_version',
    '400',
    'The requested version is not production, latest, or vN.',
  ],
  ['rate_limited', '429', 'The per-key fixed window limit was exceeded.'],
  [
    'invalid_inputs',
    '400',
    'Input names or values do not match the logic schema.',
  ],
];

export function OperationsPage() {
  return (
    <>
      <DocSection title="Rate limits">
        <p>
          Hosted API and Hosted MCP evaluation calls use fixed-window limits per
          API key. Both windows must pass: 60 requests per 10 seconds and 600
          requests per minute. These limits protect the workspace from runaway
          loops and noisy integrations.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Gauge,
              title: 'Short bursts',
              body: 'The 10-second window catches agent loops and accidental rapid retries.',
            },
            {
              icon: Cloud,
              title: 'Sustained traffic',
              body: 'The one-minute window controls longer automation runs and batch jobs.',
            },
            {
              icon: FileJson2,
              title: 'Body size',
              body: '/v1/* requests are limited to 1 MB so callers should send compact inputs.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="Error codes">
        <p>
          REST errors use a stable <code>error.code</code> and human-readable
          <code>error.message</code>. MCP protocol errors follow JSON-RPC error
          semantics, while tool execution errors are returned inside the MCP
          tool result.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {errorRows.map(([code, status, meaning]) => (
                <tr key={code}>
                  <td>
                    <code>{code}</code>
                  </td>
                  <td>{status}</td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CodeBlock
          title="Error body"
          code={`{
  "error": {
    "code": "logic_not_in_scope",
    "message": "This API key is not allowed to access the requested logic."
  }
}`}
        />
      </DocSection>

      <DocSection title="Execution logs">
        <p>
          Every authenticated evaluation writes an execution log row, including
          success, no-match, and error paths after authentication. Logs include
          caller type, caller channel, requested version, resolved version,
          result status, request ID, latency, and error details where relevant.
        </p>
        <p>
          Use request IDs from the caller side so operations teams can connect a
          LEVERIE log row with application logs, agent transcripts, support
          tickets, or batch job output.
        </p>
      </DocSection>

      <DocSection title="Checklist">
        <Checklist
          items={[
            'Use production versions for agents and external customer-facing systems.',
            'Create one API key per integration or runtime instead of sharing one workspace-wide key.',
            'Send X-Request-Id for every production call.',
            'Treat no-match as a business outcome, not the same category as an HTTP error.',
            'Rotate keys after staff changes, runtime moves, or suspected leakage.',
            'Review execution logs when changing field names, enum values, or output columns.',
          ]}
        />
      </DocSection>
    </>
  );
}
