import { useMemo } from 'react';
import type { FilterPanelProps } from './registry';
import { FilterCheckboxGroup, collectTagValues } from './FilterPrimitives';

const TAG_KEYS = ['brand', 'year', 'mileage', 'transmission'];

export function VehicleFilters({ products, values, onChange }: FilterPanelProps) {
  const groups = useMemo(() => {
    return TAG_KEYS.map((key) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      options: Array.from(collectTagValues(products, key)).sort(),
    })).filter((g) => g.options.length > 0);
  }, [products]);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <FilterCheckboxGroup
          key={g.key}
          label={g.label}
          options={g.options}
          selected={values[g.key] ?? []}
          onToggle={(val) => {
            const current = new Set(values[g.key] ?? []);
            if (current.has(val)) current.delete(val);
            else current.add(val);
            onChange({ ...values, [g.key]: Array.from(current) });
          }}
        />
      ))}
    </div>
  );
}
