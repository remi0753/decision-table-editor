import {
  FieldsSection,
  FieldsSectionActions,
} from '@/components/fields/FieldsSection';
import { DagGraph } from '@/components/graph/DagGraph';
import { AccordionSection } from '@/components/ui/AccordionSection';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';
import { TablesSection } from './TablesSection';

export function LeftPane() {
  const logic = useLogicStore((s) => s.logic);
  const setLogicName = useLogicStore((s) => s.setLogicName);
  const sections = useUiStore((s) => s.leftPaneSections);
  const toggleSection = useUiStore((s) => s.toggleLeftPaneSection);
  const t = useT();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-3 pt-3 pb-2.5 shrink-0">
        <div className="text-xs text-gray-400 mb-1 font-medium tracking-wide">
          {t.logicNameLabel}
        </div>
        <InlineEdit
          value={logic.name}
          onSave={setLogicName}
          className="font-semibold text-gray-800 text-sm block w-full"
          inputClassName="text-sm w-full"
          placeholder={t.logicNamePlaceholder}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <AccordionSection
          title={t.tableGraph}
          open={sections.dag}
          onToggle={() => toggleSection('dag')}
        >
          <DagGraph />
        </AccordionSection>

        <AccordionSection
          title={t.tableList}
          open={sections.tables}
          onToggle={() => toggleSection('tables')}
        >
          <TablesSection />
        </AccordionSection>

        <AccordionSection
          title={t.fieldDefinitions}
          open={sections.fields}
          onToggle={() => toggleSection('fields')}
          actions={<FieldsSectionActions />}
        >
          <FieldsSection />
        </AccordionSection>
      </div>
    </div>
  );
}
