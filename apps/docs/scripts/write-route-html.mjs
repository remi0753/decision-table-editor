import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '../dist/docs');
const templatePath = path.join(docsRoot, 'index.html');

const pages = [
  {
    slug: 'introduction',
    title: 'Introduction',
    description:
      'LEVERIE is a decision-table workspace for turning business rules into deterministic tools for people, systems, and AI agents.',
    sections: [
      'What LEVERIE solves',
      'How the platform is shaped',
      'Core concepts',
      'Recommended first path',
    ],
  },
  {
    slug: 'editor',
    title: 'Editor overview',
    description:
      'Tour the editor workspace: header controls, sidebar, table area, and the evaluation panel.',
    sections: [
      'Opening the editor',
      'Workspace layout',
      'Header controls',
      'Left sidebar',
      'Main work area',
      'Cloud and local modes',
    ],
  },
  {
    slug: 'tables',
    title: 'Tables and flowchart',
    description:
      'Author decision tables row by row, define fields and outputs, and read multi-table logic as a flowchart.',
    sections: [
      'Decision tables',
      'Fields and output columns',
      'Rows and conditions',
      'Multi-table logic',
      'Flowchart view',
      'Quality checks',
    ],
  },
  {
    slug: 'evaluation',
    title: 'Evaluation and testing',
    description:
      'Run real cases against your draft, inspect the trace, batch-test from CSV, and start from sample templates.',
    sections: [
      'Evaluation panel',
      'Reading the trace',
      'Batch testing',
      'Sample templates',
      'Importing and exporting',
    ],
  },
  {
    slug: 'publishing',
    title: 'Publishing',
    description:
      'Promote a reviewed draft into a stable production version that integrations can call safely.',
    sections: [
      'Draft vs production',
      'Cloud autosave',
      'Version selection',
      'Publishing habits',
    ],
  },
  {
    slug: 'sharing',
    title: 'Sharing and runners',
    description:
      'Send a stakeholder-friendly URL that runs a published logic, with viewer or runner-only access.',
    sections: [
      'What a runner is',
      'Sharing from the editor',
      'Inviting reviewers by email',
      'Accepting an invitation',
      'Stakeholder review habits',
    ],
  },
  {
    slug: 'workspace',
    title: 'Workspace management',
    description:
      'Manage organizations, workspaces, members, invitations, and roles from the settings screens.',
    sections: [
      'Organizations and workspaces',
      'Roles',
      'Organization settings',
      'Workspace settings',
      'Inviting members',
      'Removing access',
    ],
  },
  {
    slug: 'api-keys',
    title: 'API keys',
    description:
      'Create workspace-scoped credentials for trusted systems and LLM agents.',
    sections: ['Create a key', 'Scopes', 'Roles', 'Rotation'],
  },
  {
    slug: 'hosted-api',
    title: 'Hosted API',
    description:
      'Evaluate published decision logic from external services with plain HTTP and curl.',
    sections: [
      'Endpoint',
      'Request body',
      'Response body',
      'Version selection',
      'Failure behavior',
      'OpenAPI spec',
    ],
  },
  {
    slug: 'hosted-mcp',
    title: 'Hosted MCP',
    description:
      'Expose production logics as schema-rich MCP tools for agents that need deterministic decisions.',
    sections: [
      'Transport model',
      'Initialize',
      'List tools',
      'Call a tool',
      'Client configuration',
    ],
  },
  {
    slug: 'operations',
    title: 'Operations',
    description:
      'Understand limits, errors, request IDs, execution logs, and production operating habits.',
    sections: ['Rate limits', 'Error codes', 'Execution logs', 'Checklist'],
  },
];

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const replaceMeta = (html, page) => {
  const title = `${page.title} | LEVERIE Docs`;
  const description = page.description;
  const url = `https://leverie.dev/docs/${page.slug}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: title,
        description,
        url,
        isPartOf: {
          '@type': 'TechArticle',
          name: 'LEVERIE Docs',
          url: 'https://leverie.dev/docs/introduction',
        },
        about: ['decision tables', 'business rules', 'AI agents'],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'LEVERIE',
            item: 'https://leverie.dev/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Docs',
            item: 'https://leverie.dev/docs/introduction',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: page.title,
            item: url,
          },
        ],
      },
    ],
  };
  const seoContent = renderSeoContent(page);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"[^>]*>/,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"[^>]*>/,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<meta\s+property="og:title"[^>]*>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"[^>]*>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"[^>]*>/,
      `<meta property="og:url" content="${url}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"[^>]*>/,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"[^>]*>/,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    )
    .replace(
      '</head>',
      `  <script id="leverie-docs-structured-data" type="application/ld+json">${JSON.stringify(structuredData)}</script>\n</head>`,
    )
    .replace('<div id="root"></div>', `<div id="root">${seoContent}</div>`);
};

const renderSeoContent = (page) => {
  const sectionLinks = page.sections
    .map((section) => {
      const id = section
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return `          <li><a href="/docs/${page.slug}#${id}">${escapeHtml(section)}</a></li>`;
    })
    .join('\n');

  return `
    <main class="seo-fallback" aria-label="LEVERIE documentation summary">
      <nav aria-label="Breadcrumb">
        <a href="/">LEVERIE</a>
        <a href="/docs/introduction">Docs</a>
        <span>${escapeHtml(page.title)}</span>
      </nav>
      <article>
        <h1>${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.description)}</p>
        <section>
          <h2>On this page</h2>
          <ul>
${sectionLinks}
          </ul>
        </section>
        <nav aria-label="Related pages">
          <a href="/edit">Open the LEVERIE editor</a>
          <a href="/docs/hosted-api">Hosted API</a>
          <a href="/docs/hosted-mcp">Hosted MCP</a>
          <a href="/docs/evaluation">Evaluation and testing</a>
        </nav>
      </article>
    </main>
  `;
};

const template = await readFile(templatePath, 'utf8');

await Promise.all(
  pages.map(async (page) => {
    const html = replaceMeta(template, page);
    const directoryPath = path.join(docsRoot, page.slug);
    await mkdir(directoryPath, { recursive: true });
    await writeFile(path.join(directoryPath, 'index.html'), html);
  }),
);
