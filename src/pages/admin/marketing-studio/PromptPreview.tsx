import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, RotateCcw, Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";

/* LUUT dark palette (must match DisplayTab) */
const GOLD = "#E0A82E";
const GOLD2 = "#F5C451";
const CARD = "#161419";
const RAISED = "#211E26";
const LINE = "#2C2833";
const TEXT = "#B4AEBE";
const goldGrad = `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`;

interface Props {
  prompt: string;
  value?: string | null;
  onChange?: (next: string | null) => void;
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

export default function PromptPreview({ prompt, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? prompt);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

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
    <div style={{ background: CARD, borderRadius: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
          Final Prompt
          <span className="text-[11px] font-normal" style={{ color: TEXT }}>
            Full prompt preview
          </span>
          {isOverridden && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}
            >
              edited
            </span>
          )}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4" color={TEXT} />
          : <ChevronDown className="h-4 w-4" color={TEXT} />}
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3" style={{ borderColor: LINE }}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={
                editing
                  ? { background: goldGrad, color: "#1a1400" }
                  : { background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }
              }
            >
              <Pencil className="h-3 w-3" /> {editing ? "Done" : "Edit"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={!isOverridden}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {editing ? (
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(draft)}
              rows={10}
              className="w-full resize-none rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed outline-none"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
            />
          ) : (
            <pre
              className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed"
              style={{ background: RAISED, border: `1px solid ${LINE}`, color: TEXT }}
            >
{effective || "(empty)"}
            </pre>
          )}

          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>
              Add to prompt
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ADDITIONS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => append(q.text)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:brightness-125"
                  style={{ background: RAISED, border: `1px solid ${LINE}`, color: "#fff" }}
                >
                  <Plus className="h-3 w-3" style={{ color: GOLD }} /> {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
