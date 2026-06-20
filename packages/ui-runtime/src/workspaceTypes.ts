import type { EvalResult, Logic } from '@leverie/engine';

export interface WorkspaceConfig {
  version: '1';
  title?: string;
  description?: string;
  mode?: {
    defaultMode?: 'auto' | 'guided' | 'review' | 'detail';
    allowDetailMode?: boolean;
  };
  fields?: Record<string, WorkspaceFieldConfig>;
  groups?: WorkspaceFieldGroup[];
  resultTemplates?: WorkspaceResultTemplate[];
  prefill?: WorkspacePrefillConfig;
  logging?: WorkspaceLoggingConfig;
}

export interface WorkspaceFieldConfig {
  fieldId: string;
  question?: string;
  shortLabel?: string;
  helpText?: string;
  placeholder?: string;
  defaultValue?: string;
  groupId?: string;
  askOrder?: number;
  source?: 'manual' | 'prefill' | 'derived' | 'external' | 'internal';
  visibility?: 'normal' | 'collapsed' | 'detail_only' | 'hidden';
  reviewRequired?: boolean;
  sensitive?: boolean;
  inputCost?: 'low' | 'medium' | 'high';
}

export interface WorkspaceFieldGroup {
  id: string;
  name: string;
  description?: string;
  fieldIds: string[];
  order?: number;
  collapsedByDefault?: boolean;
}

export interface WorkspaceResultTemplate {
  id: string;
  match: {
    outputColumnId?: string;
    outputName?: string;
    outputValue?: string;
    outputValuesByColumnId?: Record<string, string>;
    outputValues?: Record<string, string>;
  };
  title?: string;
  reasonTemplate?: string;
  customerMessageTemplate?: string;
  internalNoteTemplate?: string;
  nextActions?: WorkspaceNextAction[];
  severity?: 'success' | 'info' | 'warning' | 'danger';
}

export interface WorkspaceNextAction {
  id: string;
  label: string;
  kind: 'copy_text' | 'open_url' | 'callback' | 'mark_done';
  textTemplate?: string;
  urlTemplate?: string;
  callbackId?: string;
  primary?: boolean;
}

export interface WorkspacePrefillConfig {
  allowUrlQuery?: boolean;
  allowJsonPaste?: boolean;
  allowEmbedPayload?: boolean;
  acceptedAliases?: Record<string, string[]>;
}

export interface WorkspaceLoggingConfig {
  enabled?: boolean;
  logInputs?: boolean;
  logSensitiveInputs?: boolean;
  logTrace?: boolean;
}

export type WorkspaceValueSource =
  | 'manual'
  | 'url_query'
  | 'json_paste'
  | 'embed'
  | 'api'
  | 'derived'
  | 'ai_extracted'
  | 'internal';

export type WorkspaceValueStatus =
  | 'known'
  | 'missing'
  | 'needs_confirmation'
  | 'confirmed'
  | 'invalid';

export interface WorkspaceValueState {
  fieldId: string;
  value: string;
  source: WorkspaceValueSource;
  status: WorkspaceValueStatus;
  evidence?: {
    label?: string;
    sourceText?: string;
    sourceUrl?: string;
    confidence?: number;
  };
  updatedAt: string;
}

export type WorkspaceMode = 'guided' | 'review' | 'detail';

export type WorkspaceDecisionStatus =
  | 'not_started'
  | 'needs_input'
  | 'needs_confirmation'
  | 'decision_ready'
  | 'no_match'
  | 'error';

export interface WorkspaceOutcomeCandidate {
  key: string;
  label: string;
  outputs?: Record<string, string>;
  certainty: 'definite' | 'possible';
}

export interface WorkspaceRecommendedCheck {
  fieldIds: string[];
  groupId?: string;
  priority: number;
  reason: string;
}

export interface WorkspaceDecisionState {
  status: WorkspaceDecisionStatus;
  finalResult?: EvalResult;
  possibleOutcomes: WorkspaceOutcomeCandidate[];
  recommendedChecks: WorkspaceRecommendedCheck[];
  missingFieldIds: string[];
  blockingFieldIds: string[];
  reason: string;
}

export interface WorkspaceRuntimeGroup {
  id: string;
  name: string;
  description?: string;
  fieldIds: string[];
  order: number;
}

export interface WorkspaceRunnerProps {
  logic: Logic;
  workspaceConfig?: WorkspaceConfig;
  initialValues?: Record<string, string>;
  initialSources?: Partial<Record<string, WorkspaceValueSource>>;
  versionLabel?: string;
  publishedAtLabel?: string;
}
