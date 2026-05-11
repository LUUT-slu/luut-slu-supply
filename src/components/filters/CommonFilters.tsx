import type { FilterPanelProps } from './registry';
import { FilterCheckboxGroup } from './FilterPrimitives';

export function CommonFilters({ values, onChange }: FilterPanelProps) {
  return (
    <FilterCheckboxGroup
      label="Availability"
      options={['In stock only']}
      selected={values.in_stock ?? []}
      onToggle={() => {
        const isOn = (values.in_stock ?? []).length > 0;
        onChange({ ...values, in_stock: isOn ? [] : ['In stock only'] });
      }}
    />
  );
}
