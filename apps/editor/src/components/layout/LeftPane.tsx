import { FieldsSection } from '@/components/fields/FieldsSection';
import { AccordionSection } from '@/components/ui/AccordionSection';
import { useT } from '@/i18n/useT';
import { useUiStore } from '@/store/uiStore';

export function LeftPane() {
  const sections = useUiStore((s) => s.leftPaneSections);
  const toggleSection = useUiStore((s) => s.toggleLeftPaneSection);
  const t = useT();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <AccordionSection
          title={t.fieldDefinitions}
          open={sections.fields}
          onToggle={() => toggleSection('fields')}
        >
          <FieldsSection />
        </AccordionSection>
      </div>
    </div>
  );
}
