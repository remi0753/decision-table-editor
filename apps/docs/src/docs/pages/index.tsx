import { ApiKeysPage } from './ApiKeysPage';
import { DecisionWorkspacePage } from './DecisionWorkspacePage';
import { EditorPage } from './EditorPage';
import { EvaluationPage } from './EvaluationPage';
import { FactCatalogPage } from './FactCatalogPage';
import { HostedApiPage } from './HostedApiPage';
import { HostedMcpPage } from './HostedMcpPage';
import { IntroductionPage } from './IntroductionPage';
import { OperationsPage } from './OperationsPage';
import { PublishingPage } from './PublishingPage';
import { SharingPage } from './SharingPage';
import { TablesPage } from './TablesPage';
import { WorkspacePage } from './WorkspacePage';

export function PageContent({ slug }: { slug: string }) {
  switch (slug) {
    case 'editor':
      return <EditorPage />;
    case 'tables':
      return <TablesPage />;
    case 'evaluation':
      return <EvaluationPage />;
    case 'decision-workspace':
      return <DecisionWorkspacePage />;
    case 'fact-catalog':
      return <FactCatalogPage />;
    case 'publishing':
      return <PublishingPage />;
    case 'sharing':
      return <SharingPage />;
    case 'workspace':
      return <WorkspacePage />;
    case 'api-keys':
      return <ApiKeysPage />;
    case 'hosted-api':
      return <HostedApiPage />;
    case 'hosted-mcp':
      return <HostedMcpPage />;
    case 'operations':
      return <OperationsPage />;
    default:
      return <IntroductionPage />;
  }
}
