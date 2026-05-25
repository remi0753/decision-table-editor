import {
  BookOpen,
  Bot,
  GitBranch,
  KeyRound,
  type LucideIcon,
  Network,
  PlayCircle,
  Send,
  ShieldCheck,
  Table2,
  TerminalSquare,
  Users,
} from 'lucide-react';

export type Page = {
  slug: string;
  title: string;
  description: string;
  group: string;
  icon: LucideIcon;
  sections: string[];
};

export const base = import.meta.env.BASE_URL;

export const pages: Page[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    description:
      'LEVERIE is a decision-table workspace for turning business rules into deterministic tools for people, systems, and AI agents.',
    group: 'Start here',
    icon: BookOpen,
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
    group: 'Editor',
    icon: Table2,
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
    group: 'Editor',
    icon: Network,
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
    group: 'Editor',
    icon: PlayCircle,
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
    group: 'Sharing and teamwork',
    icon: GitBranch,
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
    group: 'Sharing and teamwork',
    icon: Send,
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
    group: 'Sharing and teamwork',
    icon: Users,
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
    group: 'Integrations',
    icon: KeyRound,
    sections: ['Create a key', 'Scopes', 'Roles', 'Rotation'],
  },
  {
    slug: 'hosted-api',
    title: 'Hosted API',
    description:
      'Evaluate published decision logic from external services with plain HTTP and curl.',
    group: 'Integrations',
    icon: TerminalSquare,
    sections: [
      'Endpoint',
      'Request body',
      'Response body',
      'Version selection',
      'Failure behavior',
    ],
  },
  {
    slug: 'hosted-mcp',
    title: 'Hosted MCP',
    description:
      'Expose production logics as schema-rich MCP tools for agents that need deterministic decisions.',
    group: 'Integrations',
    icon: Bot,
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
    group: 'Reference',
    icon: ShieldCheck,
    sections: ['Rate limits', 'Error codes', 'Execution logs', 'Checklist'],
  },
];

export const defaultPage = pages[0] as Page;

export const groupedPages = pages.reduce<Record<string, Page[]>>(
  (groups, page) => {
    groups[page.group] = [...(groups[page.group] ?? []), page];
    return groups;
  },
  {},
);

export function pageHref(slug: string) {
  return `${base}${slug}`;
}

export function asset(name: string) {
  return `${base}${name}`;
}

export function sectionId(section: string) {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolvePage() {
  const prefix = new URL(base, window.location.origin).pathname.replace(
    /\/$/,
    '',
  );
  const path = window.location.pathname.replace(/\/$/, '');
  const slug = path.startsWith(prefix)
    ? path.slice(prefix.length).replace(/^\//, '')
    : '';
  return pages.find((page) => page.slug === slug);
}
