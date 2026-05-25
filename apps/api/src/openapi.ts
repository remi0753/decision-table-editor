// P4.6 — OpenAPI 3.1 document for the `/v1/*` public surface. Hand-written
// rather than generated from the routes (Hono doesn't carry Zod/typebox schemas
// here, and the surface is small enough — two endpoints — that a one-file spec
// is easier to keep accurate than dragging in an OpenAPI route framework).
//
// Coverage:
//   * POST /v1/logics/{logicId}/evaluate (REST evaluate, P4.2)
//   * POST /v1/mcp                       (hosted MCP JSON-RPC, P4.3)
//   * GET  /v1/openapi.json              (the document itself; self-describing)
//
// The `/api/*` browser surface (Better Auth, org/workspace/logic CRUD) is
// intentionally NOT documented here — it's cookie-based, CSRF-gated, and only
// consumed by the editor. Publishing it as a public OpenAPI doc would invite
// integrations that we don't intend to support yet.
//
// This lives in `apps/api` because the docs site links to the served
// `/v1/openapi.json` endpoint rather than importing or rendering the spec at
// build time. Keeping it beside the route makes the public API contract local
// to the worker that serves it.

export type OpenApiOptions = {
  // Absolute URL of the API origin. We expose it as the single `servers[0]` so
  // Scalar/Redoc can render a working "Try it" base. When undefined (local
  // unit tests, or BETTER_AUTH_URL unset) we fall back to a relative `/` URL
  // so the spec is still valid OpenAPI.
  serverUrl?: string;
};

export function buildOpenApiDocument(options: OpenApiOptions = {}) {
  const serverUrl = normaliseServerUrl(options.serverUrl);

  return {
    openapi: '3.1.0',
    info: {
      title: 'LEVERIE Hosted API',
      version: '0.1.0',
      summary:
        'Public HTTP + MCP surface for executing published LEVERIE decision logics.',
      description: [
        'The LEVERIE Hosted API lets external systems and LLM agents call published',
        'decision logics created in the LEVERIE editor. Every request is',
        'authenticated with a workspace-scoped API key (`Authorization: Bearer lvr_…`)',
        'and every successful call is recorded in the workspace execution log.',
        '',
        'Two surfaces are exposed under `/v1/*`:',
        '',
        '- **`POST /v1/logics/{logicId}/evaluate`** — REST endpoint that evaluates a',
        '  single logic and returns the matched outputs plus a human-readable trace.',
        '- **`POST /v1/mcp`** — stateless JSON-RPC 2.0 over HTTP implementing the',
        '  Model Context Protocol. Every logic in scope is exposed as a callable tool',
        '  with auto-generated JSON Schemas for input and output.',
        '',
        'Both surfaces share the same authentication, rate limit, and execution log',
        'semantics. Drafts are not callable — only `production`, `latest`, and pinned',
        '`vN` snapshots can be evaluated.',
      ].join('\n'),
      license: { name: 'Apache-2.0', identifier: 'Apache-2.0' },
      contact: { name: 'LEVERIE', url: 'https://leverie.dev/docs' },
    },
    servers: [{ url: serverUrl, description: 'LEVERIE API' }],
    security: [{ apiKeyAuth: [] }],
    tags: [
      {
        name: 'Evaluate',
        description: 'Execute a published decision logic over REST.',
      },
      {
        name: 'MCP',
        description:
          'Hosted Model Context Protocol server. JSON-RPC 2.0 over HTTP POST.',
      },
      {
        name: 'Meta',
        description: 'Self-describing endpoints (OpenAPI document).',
      },
    ],
    paths: {
      '/v1/logics/{logicId}/evaluate': {
        post: {
          tags: ['Evaluate'],
          summary: 'Evaluate a published logic',
          operationId: 'evaluateLogic',
          description: [
            'Evaluates the requested version of a logic against the supplied inputs.',
            '',
            'Inputs and outputs are keyed by **field / output column names** (not internal',
            'ids). Numbers and booleans are accepted as-is in JSON and coerced per the',
            "field's declared type. Unknown / unsupported inputs are dropped silently.",
            '',
            'On a successful match the response includes the matched outputs and a',
            'name-only trace step list. When no rule matches anywhere in the logic',
            'graph the response is `result.status = "no_match"` with the name of the',
            'unmatched table.',
          ].join('\n'),
          parameters: [
            {
              name: 'logicId',
              in: 'path',
              required: true,
              description: 'UUID of the logic in the API key workspace.',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'version',
              in: 'query',
              required: false,
              description:
                'Which published snapshot to evaluate. `production` (default) requires a pinned production version; `latest` resolves the most recently published version; `vN` (e.g. `v3`) targets a specific version number. `draft` is intentionally not callable.',
              schema: {
                type: 'string',
                default: 'production',
                examples: ['production', 'latest', 'v3'],
                pattern: '^(production|latest|v[1-9][0-9]{0,8})$',
              },
            },
            {
              name: 'X-Request-Id',
              in: 'header',
              required: false,
              description:
                'Optional client-provided correlation id (max 200 chars). Echoed back in the response body and written to the execution log; the server generates a UUID when absent.',
              schema: { type: 'string', maxLength: 200 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EvaluateRequest' },
                examples: {
                  loanReview: {
                    summary: 'Loan-review style inputs',
                    value: {
                      inputs: {
                        creditScore: 720,
                        annualIncome: 95000,
                        hasBankruptcy: false,
                        applicantState: 'CA',
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Evaluation completed (matched or unmatched).',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/EvaluateResponse' },
                  examples: {
                    matched: {
                      summary: 'A rule matched',
                      value: {
                        logic: {
                          id: '0190f9c4-3b4f-7d4a-9c9c-9d8b9c8e4111',
                          slug: 'loan_review',
                          name: 'Loan review',
                        },
                        version: {
                          id: '0190f9c4-3b4f-7d4a-9c9c-9d8b9c8e4222',
                          versionNumber: 3,
                          requestedType: 'production',
                        },
                        result: {
                          status: 'ok',
                          outputs: {
                            decision: 'approve',
                            rate: '5.25',
                          },
                        },
                        trace: [
                          {
                            table: 'Loan review',
                            depth: 0,
                            matchedRow: {
                              index: 1,
                              conclusion: 'output',
                            },
                            skippedRows: [],
                          },
                        ],
                        requestId: '01H7Z3F8X5Q4Y8M1N3R5V7K9P2',
                        latencyMs: 17,
                      },
                    },
                    noMatch: {
                      summary: 'No rule matched',
                      value: {
                        logic: {
                          id: '0190f9c4-3b4f-7d4a-9c9c-9d8b9c8e4111',
                          slug: 'loan_review',
                          name: 'Loan review',
                        },
                        version: {
                          id: '0190f9c4-3b4f-7d4a-9c9c-9d8b9c8e4222',
                          versionNumber: 3,
                          requestedType: 'production',
                        },
                        result: {
                          status: 'no_match',
                          unmatchedTable: 'Loan review',
                        },
                        trace: [
                          {
                            table: 'Loan review',
                            depth: 0,
                            matchedRow: null,
                            skippedRows: [
                              { index: 0, failedField: 'creditScore' },
                              { index: 1, failedField: 'creditScore' },
                            ],
                          },
                        ],
                        requestId: '01H7Z3F8X5Q4Y8M1N3R5V7K9P3',
                        latencyMs: 11,
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description:
                'Request body or `version` query parameter is malformed.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  examples: {
                    invalidInputs: {
                      value: {
                        error: {
                          code: 'invalid_inputs',
                          message:
                            'Request body must include an "inputs" object.',
                        },
                      },
                    },
                    invalidVersion: {
                      value: {
                        error: {
                          code: 'invalid_version',
                          message:
                            'version must be "production", "latest", or "vN" (positive integer).',
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  examples: {
                    missing: {
                      value: {
                        error: {
                          code: 'missing_authorization',
                          message: 'Authorization header is required.',
                        },
                      },
                    },
                    invalid: {
                      value: {
                        error: {
                          code: 'invalid_api_key',
                          message: 'Invalid API key.',
                        },
                      },
                    },
                  },
                },
              },
            },
            '403': {
              description:
                'The API key is valid but not authorised for this logic (allowlist scope).',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: {
                    error: {
                      code: 'logic_not_in_scope',
                      message:
                        'This API key does not have access to the requested logic.',
                    },
                  },
                },
              },
            },
            '404': {
              description:
                'Logic was not found in the API key workspace, or no matching version exists.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  examples: {
                    notFound: {
                      value: {
                        error: {
                          code: 'not_found',
                          message: 'Logic not found in the API key workspace.',
                        },
                      },
                    },
                    noProduction: {
                      value: {
                        error: {
                          code: 'no_published_version',
                          message:
                            'This logic has no production version pinned.',
                        },
                      },
                    },
                  },
                },
              },
            },
            '413': {
              description: 'Request body exceeds the 1 MB ceiling.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: {
                    error: {
                      code: 'payload_too_large',
                      message: 'Request body exceeds 1 MB limit.',
                    },
                  },
                },
              },
            },
            '429': {
              description:
                'Per-key rate limit exceeded. The window allows 60 req / 10 s and 600 req / 60 s.',
              headers: {
                'Retry-After': {
                  description: 'Seconds to wait before retrying.',
                  schema: { type: 'integer', minimum: 1 },
                },
              },
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/RateLimitError' },
                  example: {
                    error: {
                      code: 'rate_limited',
                      message: 'Evaluate rate limit exceeded for this API key.',
                      retryAfterSeconds: 7,
                    },
                  },
                },
              },
            },
            '500': {
              description:
                'Evaluation failed unexpectedly. The error is recorded in the execution log.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                  example: {
                    error: {
                      code: 'evaluation_failed',
                      message: 'Evaluation failed unexpectedly.',
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/v1/mcp': {
        post: {
          tags: ['MCP'],
          summary: 'Model Context Protocol endpoint (JSON-RPC 2.0)',
          operationId: 'mcpJsonRpc',
          description: [
            'Stateless JSON-RPC 2.0 endpoint implementing the Model Context Protocol.',
            'Each POST is a complete MCP message (single object or batch array); the',
            'server holds no session state between requests. Clients that need',
            'persistent sessions should reissue `initialize` per request or fall back',
            'to the Standalone MCP CLI (`leverie-mcp`).',
            '',
            '**Supported methods**:',
            '- `initialize` — returns server info, capabilities, and the negotiated',
            '  `protocolVersion` (echoes the client value when supported, otherwise',
            "  falls back to the server's latest).",
            '- `ping` — health check; returns `{}`.',
            '- `tools/list` — enumerates one tool per logic that has a pinned',
            '  production version (allowlist-scoped keys see only their allowed logics).',
            '- `tools/call` — evaluates one logic against the production snapshot.',
            '  Returns the standard MCP `content` array plus `structuredContent` with',
            '  the typed outputs and trace. Tool execution failures are returned via',
            '  `result.isError = true`, not as JSON-RPC errors.',
            '- `notifications/*` — accepted; the server responds with HTTP 204 and an',
            '  empty body (per JSON-RPC spec for notifications).',
            '',
            'Unknown methods return JSON-RPC error code `-32601` (method not found).',
            'See https://spec.modelcontextprotocol.io for the protocol reference.',
          ].join('\n'),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/JsonRpcRequest' },
                    {
                      type: 'array',
                      items: { $ref: '#/components/schemas/JsonRpcRequest' },
                      minItems: 1,
                      description: 'Batch request (processed serially).',
                    },
                  ],
                },
                examples: {
                  initialize: {
                    summary: 'initialize',
                    value: {
                      jsonrpc: '2.0',
                      id: 1,
                      method: 'initialize',
                      params: {
                        protocolVersion: '2025-06-18',
                        clientInfo: { name: 'demo-client', version: '0.1.0' },
                      },
                    },
                  },
                  toolsList: {
                    summary: 'tools/list',
                    value: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
                  },
                  toolsCall: {
                    summary: 'tools/call',
                    value: {
                      jsonrpc: '2.0',
                      id: 3,
                      method: 'tools/call',
                      params: {
                        name: 'loan_review',
                        arguments: {
                          creditScore: 720,
                          annualIncome: 95000,
                          hasBankruptcy: false,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'JSON-RPC response (single or batch).',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { $ref: '#/components/schemas/JsonRpcResponse' },
                      {
                        type: 'array',
                        items: { $ref: '#/components/schemas/JsonRpcResponse' },
                        description: 'Batch response (matches request order).',
                      },
                    ],
                  },
                },
              },
            },
            '204': {
              description:
                'Notification (method starts with `notifications/`). No body is returned, per the JSON-RPC spec.',
            },
            '400': {
              description: 'Request body is not valid JSON.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/JsonRpcErrorResponse' },
                  example: {
                    jsonrpc: '2.0',
                    id: null,
                    error: { code: -32700, message: 'Parse error.' },
                  },
                },
              },
            },
            '401': {
              description: 'Missing or invalid API key.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '413': {
              description: 'Request body exceeds the 1 MB ceiling.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '429': {
              description: 'Per-key rate limit exceeded.',
              headers: {
                'Retry-After': {
                  description: 'Seconds to wait before retrying.',
                  schema: { type: 'integer', minimum: 1 },
                },
              },
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/RateLimitError' },
                },
              },
            },
          },
        },
      },

      '/v1/openapi.json': {
        get: {
          tags: ['Meta'],
          summary: 'OpenAPI document for the LEVERIE Hosted API',
          operationId: 'getOpenApiDocument',
          security: [],
          description:
            'Returns this OpenAPI 3.1 document. Intended for SDK generators, MCP catalogs, and documentation renderers. Public — no authentication required.',
          responses: {
            '200': {
              description: 'OpenAPI 3.1 document.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    description: 'OpenAPI 3.1 root document.',
                  },
                },
              },
            },
          },
        },
      },
    },

    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'lvr_<base64url>',
          description:
            'Workspace-scoped API key issued from org settings. Send as `Authorization: Bearer lvr_<secret>`. Keys are bound to a single workspace, scoped to one or more logics (or `all`), and assigned a role (`editor` / `viewer` / `runner`).',
        },
      },
      schemas: {
        EvaluateRequest: {
          type: 'object',
          required: ['inputs'],
          additionalProperties: false,
          properties: {
            inputs: {
              type: 'object',
              description:
                'Map of field name → value. Strings, finite numbers, and booleans are accepted; the server coerces them per the field type declared in the logic. Null / undefined / arrays / nested objects are ignored. Maximum 200 keys and 4000 chars per value.',
              additionalProperties: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  { type: 'boolean' },
                ],
              },
            },
          },
        },
        EvaluateResponse: {
          type: 'object',
          required: [
            'logic',
            'version',
            'result',
            'trace',
            'requestId',
            'latencyMs',
          ],
          properties: {
            logic: {
              type: 'object',
              required: ['id', 'slug', 'name'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                slug: { type: 'string' },
                name: { type: 'string' },
              },
            },
            version: {
              type: 'object',
              required: ['id', 'versionNumber', 'requestedType'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                versionNumber: { type: 'integer', minimum: 1 },
                requestedType: {
                  type: 'string',
                  enum: ['production', 'latest', 'version'],
                  description:
                    'How the version was requested. `version` means a specific `vN` was selected; the actual number is on `versionNumber`.',
                },
              },
            },
            result: {
              oneOf: [
                { $ref: '#/components/schemas/EvaluateResultOk' },
                { $ref: '#/components/schemas/EvaluateResultNoMatch' },
              ],
              discriminator: {
                propertyName: 'status',
                mapping: {
                  ok: '#/components/schemas/EvaluateResultOk',
                  no_match: '#/components/schemas/EvaluateResultNoMatch',
                },
              },
            },
            trace: {
              type: 'array',
              items: { $ref: '#/components/schemas/TraceStep' },
              description:
                'Ordered trace of the tables the engine visited. Names only — no internal ids leak to API consumers.',
            },
            requestId: {
              type: 'string',
              description:
                'Echoed `X-Request-Id` if supplied, otherwise a server-generated UUID. Always present in the execution log for the same call.',
            },
            latencyMs: {
              type: 'integer',
              minimum: 0,
              description: 'End-to-end server-side latency in milliseconds.',
            },
          },
        },
        EvaluateResultOk: {
          type: 'object',
          required: ['status', 'outputs'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            outputs: {
              type: 'object',
              description:
                'Matched output values keyed by output column **name**. Values are stringified per the engine convention.',
              additionalProperties: { type: 'string' },
            },
          },
        },
        EvaluateResultNoMatch: {
          type: 'object',
          required: ['status', 'unmatchedTable'],
          properties: {
            status: { type: 'string', enum: ['no_match'] },
            unmatchedTable: {
              type: 'string',
              description:
                'Name of the table where evaluation stopped because no row matched.',
            },
          },
        },
        TraceStep: {
          type: 'object',
          required: ['table', 'depth', 'matchedRow', 'skippedRows'],
          properties: {
            table: { type: 'string' },
            depth: { type: 'integer', minimum: 0 },
            matchedRow: {
              oneOf: [
                { type: 'null' },
                {
                  type: 'object',
                  required: ['index', 'conclusion'],
                  properties: {
                    index: { type: 'integer', minimum: 0 },
                    conclusion: {
                      type: 'string',
                      enum: ['output', 'continue'],
                    },
                    nextTable: {
                      type: 'string',
                      description:
                        'When `conclusion` is `continue`, the name of the next table to evaluate.',
                    },
                  },
                },
              ],
            },
            skippedRows: {
              type: 'array',
              items: {
                type: 'object',
                required: ['index', 'failedField'],
                properties: {
                  index: { type: 'integer', minimum: 0 },
                  failedField: { type: 'string' },
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Machine-readable error code.',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable description.',
                },
              },
            },
          },
        },
        RateLimitError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'retryAfterSeconds'],
              properties: {
                code: { type: 'string', enum: ['rate_limited'] },
                message: { type: 'string' },
                retryAfterSeconds: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
        JsonRpcRequest: {
          type: 'object',
          required: ['jsonrpc', 'method'],
          properties: {
            jsonrpc: { type: 'string', enum: ['2.0'] },
            id: {
              description:
                'Request id. Omit for notifications. JSON-RPC allows string, number, or null.',
              oneOf: [
                { type: 'string' },
                { type: 'integer' },
                { type: 'null' },
              ],
            },
            method: {
              type: 'string',
              description:
                'MCP method. Supported: `initialize`, `ping`, `tools/list`, `tools/call`, or any `notifications/*` (notifications receive HTTP 204 with no body).',
            },
            params: {
              description:
                'Method-specific parameters. See MCP spec for the per-method shape.',
            },
          },
        },
        JsonRpcResponse: {
          type: 'object',
          required: ['jsonrpc', 'id'],
          properties: {
            jsonrpc: { type: 'string', enum: ['2.0'] },
            id: {
              oneOf: [
                { type: 'string' },
                { type: 'integer' },
                { type: 'null' },
              ],
            },
            result: {
              description:
                'Method-specific result. Present iff `error` is absent.',
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'integer',
                  description:
                    'JSON-RPC error code. -32700 parse error, -32600 invalid request, -32601 method not found, -32602 invalid params, -32603 internal error.',
                },
                message: { type: 'string' },
                data: {},
              },
            },
          },
        },
        JsonRpcErrorResponse: {
          type: 'object',
          required: ['jsonrpc', 'id', 'error'],
          properties: {
            jsonrpc: { type: 'string', enum: ['2.0'] },
            id: {
              oneOf: [
                { type: 'string' },
                { type: 'integer' },
                { type: 'null' },
              ],
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'integer' },
                message: { type: 'string' },
                data: {},
              },
            },
          },
        },
      },
    },
  } as const;
}

function normaliseServerUrl(serverUrl: string | undefined): string {
  if (!serverUrl) return '/';
  return serverUrl.replace(/\/+$/, '') || '/';
}
