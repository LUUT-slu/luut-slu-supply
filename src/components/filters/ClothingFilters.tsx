import { useMemo } from 'react';
import type { FilterPanelProps } from './registry';
import { FilterCheckboxGroup, collectVariantOptionValues, collectTagValues } from './FilterPrimitives';

const TARGET_OPTIONS = ['Size', 'Color', 'Brand', 'Gender', 'Style'];
const TAG_KEYS = ['brand', 'gender', 'style'];

export function ClothingFilters({ products, values, onChange }: FilterPanelProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const opt of TARGET_OPTIONS) {
      const vals = collectVariantOptionValues(products, opt);
      if (vals.size > 0) map.set(opt.toLowerCase(), vals);
    }
    for (const key of TAG_KEYS) {
      const vals = collectTagValues(products, key);
      if (vals.size > 0) {
        const existing = map.get(key) ?? new Set<string>();
        vals.forEach((v) => existing.add(v));
        map.set(key, existing);
      }
    }
    return Array.from(map.entries()).map(([key, set]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      options: Array.from(set).sort(),
    }));
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
