import { CloudLogicControls } from '@/components/cloud/CloudLogicControls';
import {
  FieldsSection,
  FieldsSectionActions,
} from '@/components/fields/FieldsSection';
import { LogicDescriptionField } from '@/components/logic/LogicDescriptionField';
import { AccordionSection } from '@/components/ui/AccordionSection';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

export function LeftPane() {
  const logic = useLogicStore((s) => s.logic);
  const setLogicName = useLogicStore((s) => s.setLogicName);
  const sections = useUiStore((s) => s.leftPaneSections);
  const toggleSection = useUiStore((s) => s.toggleLeftPaneSection);
  const t = useT();

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b bg-white px-3 pt-3 pb-3">
        <div className="mb-3">
          <div className="mb-1 text-xs font-medium tracking-wide text-gray-400">
            {t.logicNameLabel}
          </div>
          <InlineEdit
            value={logic.name}
            onSave={setLogicName}
            className="block w-full text-sm font-semibold text-gray-800"
            inputClassName="text-sm w-full"
            placeholder={t.logicNamePlaceholder}
          />
        </div>
        <div className="mb-3">
          <LogicDescriptionField />
        </div>
        <CloudLogicControls />
      </div>

      <div className="flex-1 overflow-y-auto">
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
