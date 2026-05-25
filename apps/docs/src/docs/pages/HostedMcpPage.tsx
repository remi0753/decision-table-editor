import { Bot, Cloud, TerminalSquare } from 'lucide-react';
import { Callout, CodeBlock, DocSection } from '../components';
import { asset } from '../metadata';

export function HostedMcpPage() {
  return (
    <>
      <DocSection title="Transport model">
        <p>
          Hosted MCP exposes LEVERIE Cloud through JSON-RPC 2.0 over stateless
          HTTP POST at <code>/v1/mcp</code>. Each request includes the API key
          in the Authorization header. The server does not require persistent
          sessions, which keeps it friendly to edge runtimes and simple bridges.
        </p>
        <p>
          This hosted surface is the cloud counterpart to the standalone local
          MCP server. Instead of pointing an agent at a local JSON file, the
          agent reaches published logic in a workspace through a scoped API key.
        </p>
        <figure className="media-card compact">
          <img
            src={asset('editor-overview.png')}
            alt="Actual LEVERIE editor sample whose published production version can become a Hosted MCP tool."
          />
          <figcaption>
            Tools are derived from production logics. The caller receives
            structured content and human-readable text.
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Initialize">
        <p>
          Send <code>initialize</code> when your client expects the MCP
          handshake. LEVERIE echoes supported protocol versions and falls back
          to the latest supported version when the provided value is unknown.
        </p>
        <CodeBlock
          title="initialize"
          code={`curl https://leverie.dev/v1/mcp \\
  -H "Authorization: Bearer lvr_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "clientInfo": { "name": "my-agent", "version": "0.1.0" }
    }
  }'`}
        />
      </DocSection>

      <DocSection title="List tools">
        <p>
          <code>tools/list</code> returns one tool for each accessible logic
          with a pinned production version. Keys with allow-list scope only see
          their selected logics. Tools without production versions are hidden
          because they cannot be called reliably.
        </p>
        <CodeBlock
          title="tools/list"
          code={`{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}`}
        />
        <Callout icon={Bot} title="Tool descriptions include business context">
          Tool descriptions include the logic description, input names and
          types, output names, and production version so an agent can choose the
          right tool without reading internal metadata.
        </Callout>
      </DocSection>

      <DocSection title="Call a tool">
        <p>
          Tool names are logic slugs. Arguments follow the generated input
          schema. A successful tool call evaluates the production snapshot and
          returns both structured content and text.
        </p>
        <CodeBlock
          title="tools/call"
          code={`{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "loan-review",
    "arguments": {
      "customerTier": "gold",
      "amount": 4200,
      "hasFraudSignal": false
    }
  }
}`}
        />
        <p>
          Evaluation failures such as invalid inputs are returned as MCP tool
          results with <code>isError: true</code>. Protocol failures such as
          unknown methods or malformed JSON-RPC requests are JSON-RPC errors.
        </p>
      </DocSection>

      <DocSection title="Client configuration">
        <p>
          Clients that support remote HTTP MCP can call
          <code>https://leverie.dev/v1/mcp</code> directly with the
          Authorization header. Clients that only support local command MCP can
          use a small bridge process that forwards JSON-RPC messages to the
          hosted endpoint.
        </p>
        <Callout
          icon={Cloud}
          title="Prefer hosted MCP for cloud-authored logic"
        >
          When authors edit and publish in LEVERIE Cloud, hosted MCP avoids
          exporting files or restarting local servers. Agent tools update when
          production versions and API key scopes change.
        </Callout>
        <Callout icon={TerminalSquare} title="Use one key per runtime">
          Give each agent runtime or bridge its own API key. Separate keys make
          revocation, usage analysis, and incident response much cleaner.
        </Callout>
      </DocSection>
    </>
  );
}
