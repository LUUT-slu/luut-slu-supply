import { useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AnalyticsFilters as Filters } from "@/hooks/useAnalyticsData";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: string[];
  sellers: { id: string; name: string }[];
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

export function AnalyticsFilterBar({ filters, onChange, categories, sellers }: Props) {
  const [activePreset, setActivePreset] = useState<string>("30 days");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const applyPreset = (label: string, days: number) => {
    setActivePreset(label);
    const end = endOfDay(new Date());
    const start = startOfDay(days === 0 ? new Date() : subDays(new Date(), days));
    onChange({ ...filters, startDate: start.toISOString(), endDate: end.toISOString() });
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      setActivePreset("custom");
      onChange({
        ...filters,
        startDate: startOfDay(customFrom).toISOString(),
        endDate: endOfDay(customTo).toISOString(),
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date presets */}
      {PRESETS.map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant={activePreset === p.label ? "default" : "outline"}
          onClick={() => applyPreset(p.label, p.days)}
        >
          {p.label}
        </Button>
      ))}

      {/* Custom date range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={activePreset === "custom" ? "default" : "outline"}
            className="gap-1"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Custom
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">From</p>
            <Calendar
              mode="single"
              selected={customFrom}
              onSelect={setCustomFrom}
              className={cn("p-2 pointer-events-auto")}
            />
            <p className="text-xs font-medium text-muted-foreground">To</p>
            <Calendar
              mode="single"
              selected={customTo}
              onSelect={setCustomTo}
              className={cn("p-2 pointer-events-auto")}
            />
            <Button size="sm" onClick={applyCustomRange} disabled={!customFrom || !customTo}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

      {/* Category filter */}
      <Select
        value={filters.category || "all"}
        onValueChange={(v) => onChange({ ...filters, category: v === "all" ? undefined : v })}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Seller filter */}
      <Select
        value={filters.sellerId || "all"}
        onValueChange={(v) => onChange({ ...filters, sellerId: v === "all" ? undefined : v })}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Seller" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sellers</SelectItem>
          {sellers.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
