import type { UnifiedProduct } from '@/lib/products';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function collectVariantOptionValues(products: UnifiedProduct[], optionName: string): Set<string> {
  const set = new Set<string>();
  const lower = optionName.toLowerCase();
  for (const p of products) {
    for (const v of p.variants) {
      for (const o of v.selectedOptions) {
        if (o.name.toLowerCase() === lower && o.value && o.value !== 'Default Title') {
          set.add(o.value);
        }
      }
    }
  }
  return set;
}

export function collectTagValues(products: UnifiedProduct[], tagKey: string): Set<string> {
  const set = new Set<string>();
  const lower = tagKey.toLowerCase();
  for (const p of products) {
    const tags = p.originalShopifyProduct?.node.tags ?? [];
    for (const t of tags) {
      const [k, v] = t.split(':');
      if (k && v && k.toLowerCase() === lower) set.add(v.trim());
    }
  }
  return set;
}

export function FilterCheckboxGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  if (options.length === 0) return null;
  const sel = new Set(selected.map((s) => s.toLowerCase()));
  return (
    <div>
      <h4 className="mb-2 font-display text-xs uppercase tracking-wider text-muted-foreground">{label}</h4>
      <ul className="space-y-1.5">
        {options.map((opt) => {
          const id = `${label}-${opt}`;
          const checked = sel.has(opt.toLowerCase());
          return (
            <li key={opt} className="flex items-center gap-2">
              <Checkbox id={id} checked={checked} onCheckedChange={() => onToggle(opt)} />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                {opt}
              </Label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
