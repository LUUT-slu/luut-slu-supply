import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, RotateCcw, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  /** Auto-generated prompt from current settings. */
  prompt: string;
  /** Optional override — when set, this is the prompt that will be sent. */
  value?: string | null;
  /** Called whenever the user edits the prompt or resets it (null = use auto). */
  onChange?: (next: string | null) => void;
  /** Optional read-only companion prompt shown collapsed above the editor (e.g. background prompt for two-stage poster). */
  secondaryPrompt?: { label: string; value: string } | null;
}

const QUICK_ADDITIONS: { label: string; text: string }[] = [
  { label: "Cleaner background", text: "Use a clean, uncluttered background with minimal distractions." },
  { label: "More dramatic lighting", text: "Add more dramatic, directional lighting with stronger shadows and rim light." },
  { label: "Softer lighting", text: "Use softer, diffused natural lighting with gentle shadows." },
  { label: "Tighter framing", text: "Tighten the framing so the product fills more of the canvas." },
  { label: "Wider scene", text: "Pull the camera back to show more of the surrounding scene and context." },
  { label: "Remove people", text: "No people, hands, or human figures should appear in the image." },
  { label: "Add lifestyle context", text: "Place the product within a believable real-world lifestyle scene that gives it narrative context." },
  { label: "Premium feel", text: "Elevate the overall feel to a premium, luxury editorial standard." },
];

export default function PromptPreview({ prompt, value, onChange, secondaryPrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? prompt);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // When the auto prompt changes and the user has no override, keep the draft in sync.
  useEffect(() => {
    if (value == null) setDraft(prompt);
  }, [prompt, value]);

  const isOverridden = value != null && value.trim() !== prompt.trim();
  const effective = value ?? prompt;

  const commit = (next: string) => {
    setDraft(next);
    if (next.trim() === prompt.trim()) onChange?.(null);
    else onChange?.(next);
  };

  const append = (extra: string) => {
    const base = (value ?? prompt).trim();
    const next = base ? `${base} ${extra}` : extra;
    commit(next);
    setOpen(true);
    setEditing(true);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const reset = () => {
    setDraft(prompt);
    onChange?.(null);
    toast.success("Prompt reset to auto");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(effective);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
      >
        <span className="flex items-center gap-2">
          Final Prompt
          {isOverridden && (
            <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-normal">
              edited
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="space-y-2 border-t bg-background/50 p-3">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={editing ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="mr-1 h-3 w-3" />
              {editing ? "Done" : "Edit"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={reset}
              disabled={!isOverridden}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={copy}
            >
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {editing ? (
            <Textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(draft)}
              rows={10}
              className="font-mono text-[11px] leading-relaxed"
            />
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
{effective || "(empty)"}
            </pre>
          )}

          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Add to prompt
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ADDITIONS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => append(q.text)}
                  className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:border-foreground"
                >
                  <Plus className="h-3 w-3" /> {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
