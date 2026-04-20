// Image preparation panel for Marketing Studio.
// Renders mode chips + a small before/after thumbnail row.

import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PrepMode, PREP_MODES } from "@/hooks/useImagePrep";

interface Props {
  sourceUrl?: string;
  preparedUrl?: string;
  mode: PrepMode;
  onModeChange: (m: PrepMode) => void;
  isProcessing: boolean;
}

export function ImagePrepPanel({
  sourceUrl,
  preparedUrl,
  mode,
  onModeChange,
  isProcessing,
}: Props) {
  const activeMeta = PREP_MODES.find((m) => m.key === mode);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wand2 className="h-3.5 w-3.5" />
        <span>Prepare image — fixes cropping & framing before export</span>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PREP_MODES.map((m) => {
          const active = mode === m.key;
          return (
            <Button
              key={m.key}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onModeChange(m.key)}
              disabled={isProcessing && !active}
              className={cn(
                "h-8 shrink-0 gap-1.5 text-xs",
                active && "shadow-sm",
              )}
            >
              {isProcessing && active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : m.ai ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : null}
              {m.label}
              {m.ai && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 px-1 py-0 text-[9px] leading-none"
                >
                  AI
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {activeMeta && (
        <p className="text-[11px] text-muted-foreground">
          {activeMeta.hint}
          {activeMeta.ai && " · uses AI credits"}
        </p>
      )}

      {sourceUrl && mode !== "original" && (
        <div className="grid grid-cols-2 gap-2">
          <Thumb label="Before" url={sourceUrl} />
          <Thumb
            label="After"
            url={preparedUrl}
            loading={isProcessing}
            transparent={mode === "remove-bg"}
          />
        </div>
      )}
    </div>
  );
}

function Thumb({
  label,
  url,
  loading,
  transparent,
}: {
  label: string;
  url?: string;
  loading?: boolean;
  transparent?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted",
          transparent &&
            "bg-[conic-gradient(at_50%_50%,#e5e7eb_25%,#f9fafb_0_50%,#e5e7eb_0_75%,#f9fafb_0)] bg-[length:12px_12px]",
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : url ? (
          <img
            src={url}
            alt={label}
            className="h-full w-full object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
