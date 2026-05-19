import type { Logic } from '@leverie/engine';
import type { Lang } from '@/i18n/translations';

export interface SampleTemplate {
  id: string;
  name: string;
  industry: string;
  summary: string;
  highlights: string[];
  buildLogic: () => Logic;
}

interface TemplateText {
  name: string;
  industry: string;
  summary: string;
  highlights: string[];
}

const TEXTS: Record<Lang, Record<string, TemplateText>> = {
  en: {
    'customer-support-routing': {
      name: 'Customer support ticket routing',
      industry: 'Customer Support',
      summary:
        'Route incoming tickets to the right queue with an SLA, based on priority, customer tier, outage flag, and category. Multi-table chain via "continue" conclusions.',
      highlights: [
        '3 tables, chained via continue',
        '4 inputs (priority, tier, outage flag, category)',
        'Outputs queue + SLA per case',
      ],
    },
    'refund-eligibility': {
      name: 'Refund eligibility',
      industry: 'E-commerce / Operations',
      summary:
        'Decide whether an order qualifies for a full refund, partial refund (with restocking fee), or rejection — based on item category, days since order, customer tier, order total, and damage flag.',
      highlights: [
        '7 rules covering damage / category / age / loyalty',
        'Demonstrates =, <=, >, between, and in operators',
        'Outputs decision + reason',
      ],
    },
    'credit-screening': {
      name: 'Credit screening',
      industry: 'Finance',
      summary:
        'Approve, reject, or flag a loan application for manual review, based on customer type, requested amount, and whether a guarantor is on file.',
      highlights: [
        'Single table, 5 rules',
        'Mixes enum, number, and bool inputs',
        'Outputs decision + reason',
      ],
    },
  },
  ja: {
    'customer-support-routing': {
      name: '顧客サポート振り分け',
      industry: 'カスタマーサポート',
      summary:
        '優先度・顧客ティア・障害フラグ・カテゴリから、問い合わせを適切なキュー＋ SLA に振り分けます。「continue」で複数テーブルを連結した実務的なポリシー例です。',
      highlights: [
        'テーブル3つ（continue で連結）',
        '入力 4 種類（優先度・ティア・障害・カテゴリ）',
        '結論として担当キュー＋ SLA を出力',
      ],
    },
    'refund-eligibility': {
      name: '返金可否判定',
      industry: 'EC / オペレーション',
      summary:
        'カテゴリ・経過日数・顧客ティア・注文金額・破損フラグから、全額返金／一部返金（手数料あり）／不可 を判定します。',
      highlights: [
        '7 ルール（破損・カテゴリ例外・標準期間・ロイヤルティ拡張など）',
        '=・<=・>・between・in を網羅した条件式',
        '結論として判定＋理由を出力',
      ],
    },
    'credit-screening': {
      name: '与信スクリーニング',
      industry: '金融',
      summary:
        '顧客種別・申込金額・保証人の有無に応じて、承認／否認／手動審査 のいずれかを判定します。',
      highlights: [
        '1 テーブル・5 ルール',
        'enum / 数値 / 真偽値を組み合わせた入力',
        '結論として判定＋理由を出力',
      ],
    },
  },
};

interface NameSet {
  logicName: string;
  fields: Record<string, { name: string; enumValues?: string[] }>;
  tables: Record<string, { name: string }>;
  outputCols: Record<string, { name: string }>;
  values: Record<string, string>;
}

// ---------- Customer support routing ----------

const SUPPORT_NAMES: Record<Lang, NameSet> = {
  en: {
    logicName: 'Customer support ticket routing',
    fields: {
      priority: {
        name: 'Priority',
        enumValues: ['P0', 'P1', 'P2', 'P3'],
      },
      tier: {
        name: 'Customer Tier',
        enumValues: ['Free', 'Pro', 'Enterprise'],
      },
      outage: { name: 'Production outage?' },
      category: {
        name: 'Category',
        enumValues: ['Billing', 'Technical', 'Account', 'General'],
      },
    },
    tables: {
      triage: { name: 'Triage' },
      escalation: { name: 'Escalation' },
      standard: { name: 'Standard routing' },
    },
    outputCols: {
      queue: { name: 'Queue' },
      sla: { name: 'SLA' },
    },
    values: {
      P0: 'P0',
      P1: 'P1',
      P2: 'P2',
      P3: 'P3',
      Free: 'Free',
      Pro: 'Pro',
      Enterprise: 'Enterprise',
      Billing: 'Billing',
      Technical: 'Technical',
      Account: 'Account',
      General: 'General',
      urgentQueue: 'Urgent queue',
      pageOncall: 'Page on-call engineer',
      tier2: 'Tier-2 escalation',
      billingTeam: 'Billing team',
      engineering: 'Engineering',
      accountTeam: 'Account team',
      generalQueue: 'General queue',
      sla1h: '1 hour',
      sla15m: '15 minutes',
      sla4h: '4 hours',
      sla1bd: '1 business day',
      sla2bd: '2 business days',
      sla3bd: '3 business days',
    },
  },
  ja: {
    logicName: '顧客サポート振り分け',
    fields: {
      priority: {
        name: '優先度',
        enumValues: ['P0', 'P1', 'P2', 'P3'],
      },
      tier: {
        name: '顧客ティア',
        enumValues: ['無料', 'プロ', 'エンタープライズ'],
      },
      outage: { name: '本番障害？' },
      category: {
        name: 'カテゴリ',
        enumValues: ['請求', '技術', 'アカウント', '一般'],
      },
    },
    tables: {
      triage: { name: 'トリアージ' },
      escalation: { name: 'エスカレーション' },
      standard: { name: '標準振り分け' },
    },
    outputCols: {
      queue: { name: 'キュー' },
      sla: { name: 'SLA' },
    },
    values: {
      P0: 'P0',
      P1: 'P1',
      P2: 'P2',
      P3: 'P3',
      Free: '無料',
      Pro: 'プロ',
      Enterprise: 'エンタープライズ',
      Billing: '請求',
      Technical: '技術',
      Account: 'アカウント',
      General: '一般',
      urgentQueue: '緊急キュー',
      pageOncall: 'オンコール呼び出し',
      tier2: 'Tier-2 エスカレーション',
      billingTeam: '請求チーム',
      engineering: 'エンジニアリング',
      accountTeam: 'アカウントチーム',
      generalQueue: '一般キュー',
      sla1h: '1 時間以内',
      sla15m: '15 分以内',
      sla4h: '4 時間以内',
      sla1bd: '翌営業日',
      sla2bd: '2 営業日以内',
      sla3bd: '3 営業日以内',
    },
  },
};

function buildSupportTicketRouting(lang: Lang): Logic {
  const n = SUPPORT_NAMES[lang];
  return {
    version: '2',
    name: n.logicName,
    description: TEXTS[lang]['customer-support-routing']?.summary,
    entryTableId: 't1',
    fieldDefs: {
      f1: {
        id: 'f1',
        name: n.fields.priority?.name ?? 'Priority',
        type: 'enum',
        enumValues: n.fields.priority?.enumValues,
      },
      f2: {
        id: 'f2',
        name: n.fields.tier?.name ?? 'Tier',
        type: 'enum',
        enumValues: n.fields.tier?.enumValues,
      },
      f3: {
        id: 'f3',
        name: n.fields.outage?.name ?? 'Outage',
        type: 'bool',
      },
      f4: {
        id: 'f4',
        name: n.fields.category?.name ?? 'Category',
        type: 'enum',
        enumValues: n.fields.category?.enumValues,
      },
    },
    tables: {
      t1: {
        id: 't1',
        name: n.tables.triage?.name ?? 'Triage',
        cols: [
          { id: 'c1', fieldId: 'f1' },
          { id: 'c2', fieldId: 'f2' },
        ],
        outputCols: [
          { id: 'oc1', name: n.outputCols.queue?.name ?? 'Queue' },
          { id: 'oc2', name: n.outputCols.sla?.name ?? 'SLA' },
        ],
        rows: [
          {
            id: 'r1',
            cells: {
              c1: { op: '=', val: n.values.P0 },
              c2: { op: '=', val: n.values.Enterprise },
            },
            conclusion: { type: 'continue', tableId: 't2' },
          },
          {
            id: 'r2',
            cells: { c1: { op: '=', val: n.values.P0 } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.urgentQueue ?? '',
                oc2: n.values.sla1h ?? '',
              },
            },
          },
          {
            id: 'r3',
            cells: {
              c1: { op: '=', val: n.values.P1 },
              c2: { op: '=', val: n.values.Enterprise },
            },
            conclusion: { type: 'continue', tableId: 't2' },
          },
          {
            id: 'r4',
            cells: {},
            conclusion: { type: 'continue', tableId: 't3' },
          },
        ],
      },
      t2: {
        id: 't2',
        name: n.tables.escalation?.name ?? 'Escalation',
        cols: [{ id: 'c3', fieldId: 'f3' }],
        outputCols: [
          { id: 'oc3', name: n.outputCols.queue?.name ?? 'Queue' },
          { id: 'oc4', name: n.outputCols.sla?.name ?? 'SLA' },
        ],
        rows: [
          {
            id: 'r5',
            cells: { c3: { op: '=', val: 'true' } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc3: n.values.pageOncall ?? '',
                oc4: n.values.sla15m ?? '',
              },
            },
          },
          {
            id: 'r6',
            cells: {},
            conclusion: {
              type: 'terminal',
              outputs: {
                oc3: n.values.tier2 ?? '',
                oc4: n.values.sla4h ?? '',
              },
            },
          },
        ],
      },
      t3: {
        id: 't3',
        name: n.tables.standard?.name ?? 'Standard routing',
        cols: [{ id: 'c4', fieldId: 'f4' }],
        outputCols: [
          { id: 'oc5', name: n.outputCols.queue?.name ?? 'Queue' },
          { id: 'oc6', name: n.outputCols.sla?.name ?? 'SLA' },
        ],
        rows: [
          {
            id: 'r7',
            cells: { c4: { op: '=', val: n.values.Billing } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc5: n.values.billingTeam ?? '',
                oc6: n.values.sla1bd ?? '',
              },
            },
          },
          {
            id: 'r8',
            cells: { c4: { op: '=', val: n.values.Technical } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc5: n.values.engineering ?? '',
                oc6: n.values.sla2bd ?? '',
              },
            },
          },
          {
            id: 'r9',
            cells: { c4: { op: '=', val: n.values.Account } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc5: n.values.accountTeam ?? '',
                oc6: n.values.sla1bd ?? '',
              },
            },
          },
          {
            id: 'r10',
            cells: {},
            conclusion: {
              type: 'terminal',
              outputs: {
                oc5: n.values.generalQueue ?? '',
                oc6: n.values.sla3bd ?? '',
              },
            },
          },
        ],
      },
    },
    nField: 5,
    nTable: 4,
    nCol: 5,
    nOCol: 7,
    nRow: 11,
  };
}

// ---------- Refund eligibility ----------

const REFUND_NAMES: Record<Lang, NameSet> = {
  en: {
    logicName: 'Refund eligibility',
    fields: {
      category: {
        name: 'Item category',
        enumValues: ['Electronics', 'Clothing', 'Consumables', 'Services'],
      },
      days: { name: 'Days since order' },
      tier: {
        name: 'Customer tier',
        enumValues: ['Standard', 'Gold', 'Platinum'],
      },
      total: { name: 'Order total' },
      damaged: { name: 'Damaged?' },
    },
    tables: {
      eligibility: { name: 'Eligibility' },
    },
    outputCols: {
      decision: { name: 'Decision' },
      reason: { name: 'Reason' },
    },
    values: {
      Electronics: 'Electronics',
      Clothing: 'Clothing',
      Consumables: 'Consumables',
      Services: 'Services',
      Standard: 'Standard',
      Gold: 'Gold',
      Platinum: 'Platinum',
      Approve: 'Approve',
      Reject: 'Reject',
      Partial: 'Partial refund',
      reasonDamaged: 'Damaged item: full refund regardless of age',
      reasonServices: 'Services are non-refundable once delivered',
      reasonConsumables: 'Consumables non-refundable after 7 days',
      reasonStandard: 'Within the standard 14-day return window',
      reasonLoyalty: 'Loyalty tier: extended 30-day window',
      reasonPartial:
        'Outside standard window but high-value order: 15% restocking fee applies',
      reasonOutside: 'Outside the refund window',
    },
  },
  ja: {
    logicName: '返金可否判定',
    fields: {
      category: {
        name: '商品カテゴリ',
        enumValues: ['電化製品', '衣類', '消耗品', 'サービス'],
      },
      days: { name: '注文からの経過日数' },
      tier: {
        name: '顧客ティア',
        enumValues: ['通常', 'ゴールド', 'プラチナ'],
      },
      total: { name: '注文金額' },
      damaged: { name: '破損あり？' },
    },
    tables: {
      eligibility: { name: '判定' },
    },
    outputCols: {
      decision: { name: '判定' },
      reason: { name: '理由' },
    },
    values: {
      Electronics: '電化製品',
      Clothing: '衣類',
      Consumables: '消耗品',
      Services: 'サービス',
      Standard: '通常',
      Gold: 'ゴールド',
      Platinum: 'プラチナ',
      Approve: '全額返金',
      Reject: '返金不可',
      Partial: '一部返金',
      reasonDamaged: '破損商品は経過日数によらず全額返金',
      reasonServices: '提供済みサービスは返金不可',
      reasonConsumables: '消耗品は 7 日経過後は返金不可',
      reasonStandard: '標準の 14 日間返品期間内',
      reasonLoyalty: 'ロイヤルティ会員のため 30 日まで延長',
      reasonPartial: '標準期間外だが高額注文のため 15% 手数料で一部返金',
      reasonOutside: '返金期間外',
    },
  },
};

function buildRefundEligibility(lang: Lang): Logic {
  const n = REFUND_NAMES[lang];
  return {
    version: '2',
    name: n.logicName,
    description: TEXTS[lang]['refund-eligibility']?.summary,
    entryTableId: 't1',
    fieldDefs: {
      f1: {
        id: 'f1',
        name: n.fields.category?.name ?? 'Category',
        type: 'enum',
        enumValues: n.fields.category?.enumValues,
      },
      f2: {
        id: 'f2',
        name: n.fields.days?.name ?? 'Days',
        type: 'number',
      },
      f3: {
        id: 'f3',
        name: n.fields.tier?.name ?? 'Tier',
        type: 'enum',
        enumValues: n.fields.tier?.enumValues,
      },
      f4: {
        id: 'f4',
        name: n.fields.total?.name ?? 'Order total',
        type: 'number',
      },
      f5: {
        id: 'f5',
        name: n.fields.damaged?.name ?? 'Damaged',
        type: 'bool',
      },
    },
    tables: {
      t1: {
        id: 't1',
        name: n.tables.eligibility?.name ?? 'Eligibility',
        cols: [
          { id: 'c1', fieldId: 'f1' },
          { id: 'c2', fieldId: 'f2' },
          { id: 'c3', fieldId: 'f3' },
          { id: 'c4', fieldId: 'f4' },
          { id: 'c5', fieldId: 'f5' },
        ],
        outputCols: [
          { id: 'oc1', name: n.outputCols.decision?.name ?? 'Decision' },
          { id: 'oc2', name: n.outputCols.reason?.name ?? 'Reason' },
        ],
        rows: [
          {
            id: 'r1',
            cells: { c5: { op: '=', val: 'true' } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Approve ?? '',
                oc2: n.values.reasonDamaged ?? '',
              },
            },
          },
          {
            id: 'r2',
            cells: { c1: { op: '=', val: n.values.Services } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Reject ?? '',
                oc2: n.values.reasonServices ?? '',
              },
            },
          },
          {
            id: 'r3',
            cells: {
              c1: { op: '=', val: n.values.Consumables },
              c2: { op: '>', val: '7' },
            },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Reject ?? '',
                oc2: n.values.reasonConsumables ?? '',
              },
            },
          },
          {
            id: 'r4',
            cells: { c2: { op: '<=', val: '14' } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Approve ?? '',
                oc2: n.values.reasonStandard ?? '',
              },
            },
          },
          {
            id: 'r5',
            cells: {
              c2: { op: '<=', val: '30' },
              c3: {
                op: 'in',
                val: [n.values.Gold ?? '', n.values.Platinum ?? ''],
              },
            },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Approve ?? '',
                oc2: n.values.reasonLoyalty ?? '',
              },
            },
          },
          {
            id: 'r6',
            cells: {
              c2: { op: 'between', val: ['15', '30'] },
              c4: { op: '>=', val: '200' },
            },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Partial ?? '',
                oc2: n.values.reasonPartial ?? '',
              },
            },
          },
          {
            id: 'r7',
            cells: {},
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Reject ?? '',
                oc2: n.values.reasonOutside ?? '',
              },
            },
          },
        ],
      },
    },
    nField: 6,
    nTable: 2,
    nCol: 6,
    nOCol: 3,
    nRow: 8,
  };
}

// ---------- Credit screening (loan review) ----------

const CREDIT_NAMES: Record<Lang, NameSet> = {
  en: {
    logicName: 'Credit screening',
    fields: {
      customerType: {
        name: 'Customer type',
        enumValues: ['Corporate', 'Individual'],
      },
      amount: { name: 'Requested amount' },
      guarantor: { name: 'Has guarantor?' },
    },
    tables: {
      review: { name: 'Review' },
    },
    outputCols: {
      decision: { name: 'Decision' },
      reason: { name: 'Reason' },
    },
    values: {
      Corporate: 'Corporate',
      Individual: 'Individual',
      Approve: 'Approve',
      Reject: 'Reject',
      Manual: 'Manual review',
      reasonCorpLarge: 'Corporate loan above 5,000,000 needs senior approval',
      reasonCorpStandard: 'Standard corporate loan',
      reasonGuarantorCovered: 'Individual loan within guarantor coverage',
      reasonGuarantorReview:
        'Individual loan above 1,000,000 needs reviewer check',
      reasonNoGuarantor: 'Individual loan requires a guarantor',
    },
  },
  ja: {
    logicName: '与信スクリーニング',
    fields: {
      customerType: {
        name: '顧客種別',
        enumValues: ['法人', '個人'],
      },
      amount: { name: '申込金額' },
      guarantor: { name: '保証人あり？' },
    },
    tables: {
      review: { name: '審査' },
    },
    outputCols: {
      decision: { name: '判定' },
      reason: { name: '理由' },
    },
    values: {
      Corporate: '法人',
      Individual: '個人',
      Approve: '承認',
      Reject: '否認',
      Manual: '手動審査',
      reasonCorpLarge: '法人で 500 万円超のため上長承認が必要',
      reasonCorpStandard: '標準的な法人融資',
      reasonGuarantorCovered: '個人融資・保証人ありで保証範囲内',
      reasonGuarantorReview: '個人で 100 万円超のため担当者確認が必要',
      reasonNoGuarantor: '個人融資には保証人が必要',
    },
  },
};

function buildCreditScreening(lang: Lang): Logic {
  const n = CREDIT_NAMES[lang];
  return {
    version: '2',
    name: n.logicName,
    description: TEXTS[lang]['credit-screening']?.summary,
    entryTableId: 't1',
    fieldDefs: {
      f1: {
        id: 'f1',
        name: n.fields.customerType?.name ?? 'Customer type',
        type: 'enum',
        enumValues: n.fields.customerType?.enumValues,
      },
      f2: {
        id: 'f2',
        name: n.fields.amount?.name ?? 'Amount',
        type: 'number',
      },
      f3: {
        id: 'f3',
        name: n.fields.guarantor?.name ?? 'Has guarantor',
        type: 'bool',
      },
    },
    tables: {
      t1: {
        id: 't1',
        name: n.tables.review?.name ?? 'Review',
        cols: [
          { id: 'c1', fieldId: 'f1' },
          { id: 'c2', fieldId: 'f2' },
          { id: 'c3', fieldId: 'f3' },
        ],
        outputCols: [
          { id: 'oc1', name: n.outputCols.decision?.name ?? 'Decision' },
          { id: 'oc2', name: n.outputCols.reason?.name ?? 'Reason' },
        ],
        rows: [
          {
            id: 'r1',
            cells: {
              c1: { op: '=', val: n.values.Corporate },
              c2: { op: '>=', val: '5000000' },
            },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Manual ?? '',
                oc2: n.values.reasonCorpLarge ?? '',
              },
            },
          },
          {
            id: 'r2',
            cells: { c1: { op: '=', val: n.values.Corporate } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Approve ?? '',
                oc2: n.values.reasonCorpStandard ?? '',
              },
            },
          },
          {
            id: 'r3',
            cells: {
              c1: { op: '=', val: n.values.Individual },
              c3: { op: '=', val: 'true' },
              c2: { op: '<', val: '1000000' },
            },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Approve ?? '',
                oc2: n.values.reasonGuarantorCovered ?? '',
              },
            },
          },
          {
            id: 'r4',
            cells: {
              c1: { op: '=', val: n.values.Individual },
              c3: { op: '=', val: 'true' },
            },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Manual ?? '',
                oc2: n.values.reasonGuarantorReview ?? '',
              },
            },
          },
          {
            id: 'r5',
            cells: { c1: { op: '=', val: n.values.Individual } },
            conclusion: {
              type: 'terminal',
              outputs: {
                oc1: n.values.Reject ?? '',
                oc2: n.values.reasonNoGuarantor ?? '',
              },
            },
          },
        ],
      },
    },
    nField: 4,
    nTable: 2,
    nCol: 4,
    nOCol: 3,
    nRow: 6,
  };
}

const BUILDERS: Record<string, (lang: Lang) => Logic> = {
  'customer-support-routing': buildSupportTicketRouting,
  'refund-eligibility': buildRefundEligibility,
  'credit-screening': buildCreditScreening,
};

export function getSampleTemplates(lang: Lang): SampleTemplate[] {
  const order = [
    'customer-support-routing',
    'refund-eligibility',
    'credit-screening',
  ];
  return order.map((id) => {
    const text = TEXTS[lang][id];
    if (!text) throw new Error(`Missing text for template ${id} in ${lang}`);
    const builder = BUILDERS[id];
    if (!builder) throw new Error(`Missing builder for template ${id}`);
    return {
      id,
      name: text.name,
      industry: text.industry,
      summary: text.summary,
      highlights: text.highlights,
      buildLogic: () => builder(lang),
    };
  });
}
