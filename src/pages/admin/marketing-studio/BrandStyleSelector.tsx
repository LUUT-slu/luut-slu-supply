import { BRAND_STYLES, type BrandStyle } from "@/lib/marketingRouting";

export default function BrandStyleSelector({
  value,
  onChange,
}: {
  value: BrandStyle;
  onChange: (b: BrandStyle) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Brand Style
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BrandStyle)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        {BRAND_STYLES.map((b) => (
          <option key={b.key} value={b.key}>
            {b.label}
          </option>
        ))}
      </select>
    </div>
  );
}
