import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function PromptPreview({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
      >
        <span>View Final Prompt</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t bg-background/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
{prompt || "(empty)"}
        </pre>
      )}
    </div>
  );
}
