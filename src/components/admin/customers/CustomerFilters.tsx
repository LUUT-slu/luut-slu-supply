import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

export type AccountFilter = "all" | "account" | "guest";
export type OrderFilter = "all" | "0" | "1+" | "5+";
export type ContactFilter = "all" | "never" | "30d" | "7d";

export interface CustomerFiltersValue {
  search: string;
  account: AccountFilter;
  orders: OrderFilter;
  hasDiscount: boolean;
  contact: ContactFilter;
  tags: string[];
}

interface Props {
  value: CustomerFiltersValue;
  onChange: (v: CustomerFiltersValue) => void;
  availableTags: string[];
}

export function CustomerFilters({ value, onChange, availableTags }: Props) {
  const update = (patch: Partial<CustomerFiltersValue>) => onChange({ ...value, ...patch });

  const toggleTag = (tag: string) => {
    update({
      tags: value.tags.includes(tag) ? value.tags.filter((t) => t !== tag) : [...value.tags, tag],
    });
  };

  const reset = () =>
    onChange({ search: "", account: "all", orders: "all", hasDiscount: false, contact: "all", tags: [] });

  const hasActive =
    value.search ||
    value.account !== "all" ||
    value.orders !== "all" ||
    value.hasDiscount ||
    value.contact !== "all" ||
    value.tags.length > 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, phone, email…"
          value={value.search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-9 h-11"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "account", "guest"] as AccountFilter[]).map((opt) => (
          <Button
            key={opt}
            size="sm"
            variant={value.account === opt ? "default" : "outline"}
            className="h-8 text-xs capitalize"
            onClick={() => update({ account: opt })}
          >
            {opt === "all" ? "All accounts" : opt === "account" ? "Has account" : "Guest"}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "0", "1+", "5+"] as OrderFilter[]).map((opt) => (
          <Button
            key={opt}
            size="sm"
            variant={value.orders === opt ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => update({ orders: opt })}
          >
            {opt === "all" ? "Any orders" : `${opt} orders`}
          </Button>
        ))}
        <Button
          size="sm"
          variant={value.hasDiscount ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => update({ hasDiscount: !value.hasDiscount })}
        >
          Has discount
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "never", "30d", "7d"] as ContactFilter[]).map((opt) => (
          <Button
            key={opt}
            size="sm"
            variant={value.contact === opt ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => update({ contact: opt })}
          >
            {opt === "all"
              ? "Any contact"
              : opt === "never"
              ? "Never contacted"
              : opt === "30d"
              ? ">30d ago"
              : "<7d ago"}
          </Button>
        ))}
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center mr-1">Tags:</span>
          {availableTags.slice(0, 12).map((tag) => (
            <Badge
              key={tag}
              variant={value.tags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer h-7 px-2"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {hasActive && (
        <Button size="sm" variant="ghost" onClick={reset} className="h-7 text-xs gap-1">
          <X className="h-3 w-3" /> Reset filters
        </Button>
      )}
    </div>
  );
}
