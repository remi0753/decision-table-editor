import { FieldsSection } from '@/components/fields/FieldsSection';

export function LeftPane() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <FieldsSection />
      </div>
    </div>
  );
}
