import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Undo2,
  Redo2,
  RotateCcw,
  Check,
  X as XIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  CropState,
  DEFAULT_CROP,
  MAX_SCALE,
  MIN_SCALE,
  clampCrop,
  cropToTransform,
} from "@/lib/imageCropState";
import { useImageEditHistory } from "@/hooks/useImageEditHistory";
import type { TemplateFormat } from "./templates";

interface ImageEditorModalProps {
  open: boolean;
  imageUrl: string | null;
  format: TemplateFormat;
  initialCrop?: CropState;
  onSave: (crop: CropState) => void;
  onClose: () => void;
}

const FRAME_RATIO: Record<TemplateFormat, number> = {
  story: 9 / 16,
  post: 1,
  ad: 1200 / 628,
  portrait: 4 / 5,
};

export function ImageEditorModal({
  open,
  imageUrl,
  format,
  initialCrop,
  onSave,
  onClose,
}: ImageEditorModalProps) {
  const baseline = initialCrop ?? DEFAULT_CROP;
  const history = useImageEditHistory(baseline);
  const [showSafeArea, setShowSafeArea] = useState(true);

  // Reset history whenever the modal re-opens for a new image
  useEffect(() => {
    if (open) {
      history.reset(initialCrop ?? DEFAULT_CROP);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, imageUrl]);

  const frameRef = useRef<HTMLDivElement>(null);
  // Track frame size so drag math uses real pixels.
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!open) return;
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setFrameSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // ---------- Pointer-based drag + pinch ----------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStartCrop = useRef<CropState | null>(null);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef<number>(1);
  const rafId = useRef<number | null>(null);
  const pendingCrop = useRef<CropState | null>(null);
  const movedDuringGesture = useRef(false);

  const flushFrame = useCallback(() => {
    rafId.current = null;
    if (pendingCrop.current) {
      history.set(pendingCrop.current);
      pendingCrop.current = null;
    }
  }, [history]);

  const scheduleSet = useCallback(
    (next: CropState) => {
      pendingCrop.current = clampCrop(next);
      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(flushFrame);
      }
    },
    [flushFrame],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragStartCrop.current = history.present;
    movedDuringGesture.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStartDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartScale.current = history.present.scale;
    } else {
      pinchStartDist.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const start = dragStartCrop.current;
    if (!start) return;

    if (pointers.current.size === 2 && pinchStartDist.current) {
      // Pinch zoom
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / pinchStartDist.current;
      const next: CropState = {
        ...start,
        scale: pinchStartScale.current * factor,
      };
      movedDuringGesture.current = true;
      scheduleSet(next);
      return;
    }

    // Single-pointer drag
    const first = pointers.current.values().next().value;
    if (!first || !frameSize.w || !frameSize.h) return;
    // Re-derive deltas from the gesture start position
    const startPos = Array.from(pointers.current.entries())[0];
    if (!startPos) return;
    // We need the original anchor; store it once per gesture
    if (!gestureAnchor.current) {
      gestureAnchor.current = { x: e.clientX, y: e.clientY };
    }
  };

  // Anchor for drag math (recorded on first move)
  const gestureAnchor = useRef<{ x: number; y: number } | null>(null);
  const onPointerMoveDrag = useCallback(
    (e: PointerEvent) => {
      if (pointers.current.size !== 1) return;
      const start = dragStartCrop.current;
      if (!start || !frameSize.w || !frameSize.h) return;
      if (!gestureAnchor.current) return;
      const dx = e.clientX - gestureAnchor.current.x;
      const dy = e.clientY - gestureAnchor.current.y;
      // Convert pixel delta to normalized offset (relative to frame size).
      // Pulling right reveals more of the image's left side -> offsetX +.
      const ox = start.offsetX + (dx / frameSize.w) * 2 * start.scale;
      const oy = start.offsetY + (dy / frameSize.h) * 2 * start.scale;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      movedDuringGesture.current = true;
      scheduleSet({ ...start, offsetX: ox, offsetY: oy });
    },
    [frameSize.h, frameSize.w, scheduleSet],
  );

  // Wire native pointer move on the window so dragging stays smooth even
  // outside the frame bounds.
  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      if (pointers.current.size === 2) {
        // Pinch handled by React handler (synthetic).
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const start = dragStartCrop.current;
        if (!start || !pinchStartDist.current) return;
        const [a, b] = Array.from(pointers.current.values());
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const factor = dist / pinchStartDist.current;
        movedDuringGesture.current = true;
        scheduleSet({ ...start, scale: pinchStartScale.current * factor });
        return;
      }
      onPointerMoveDrag(e);
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) {
        // Commit to history if anything actually changed.
        if (movedDuringGesture.current && dragStartCrop.current) {
          // Flush the latest frame first
          if (pendingCrop.current) {
            history.set(pendingCrop.current);
            pendingCrop.current = null;
          }
          history.push(history.present);
        }
        dragStartCrop.current = null;
        gestureAnchor.current = null;
        pinchStartDist.current = null;
        movedDuringGesture.current = false;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [open, onPointerMoveDrag, history, scheduleSet]);

  // Wheel zoom (desktop)
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const next = clampCrop({
      ...history.present,
      scale: history.present.scale * factor,
    });
    history.push(next);
  };

  // Slider
  const onSlider = (vals: number[]) => {
    const v = vals[0];
    if (typeof v !== "number") return;
    history.set(clampCrop({ ...history.present, scale: v }));
  };
  const onSliderCommit = (vals: number[]) => {
    const v = vals[0];
    if (typeof v !== "number") return;
    history.push(clampCrop({ ...history.present, scale: v }));
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, history, onClose]);

  const handleSave = () => {
    onSave(clampCrop(history.present));
    onClose();
  };

  const ratio = FRAME_RATIO[format];
  // Compute frame display size — fit within available modal space.
  const frameStyle = useMemo<React.CSSProperties>(() => {
    return {
      aspectRatio: String(ratio),
      maxHeight: "min(60vh, 520px)",
      maxWidth: "min(92vw, 480px)",
      width: ratio >= 1 ? "min(92vw, 480px)" : "auto",
      margin: "0 auto",
    };
  }, [ratio]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl p-4 sm:p-6">
        <DialogTitle className="text-base">Edit image</DialogTitle>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={history.undo}
              disabled={!history.canUndo}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={history.redo}
              disabled={!history.canRedo}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => history.reset(DEFAULT_CROP)}
              aria-label="Reset"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Reset</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="safe-area"
              checked={showSafeArea}
              onCheckedChange={setShowSafeArea}
            />
            <Label htmlFor="safe-area" className="text-xs">
              Safe area
            </Label>
          </div>
        </div>

        {/* Frame */}
        <div
          className="relative select-none overflow-hidden rounded-md border bg-black"
          style={{ ...frameStyle, touchAction: "none" }}
        >
          <div
            ref={frameRef}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onWheel={onWheel}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                crossOrigin="anonymous"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: cropToTransform(history.present),
                  transformOrigin: "center center",
                  willChange: "transform",
                  pointerEvents: "none",
                }}
              />
            )}
            {showSafeArea && (
              <>
                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 border-b border-dashed border-white/40"
                  style={{ height: "20%" }}
                />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-dashed border-white/40"
                  style={{ height: "25%" }}
                />
                <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">
                  Headline area
                </div>
                <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">
                  Price + CTA area
                </div>
              </>
            )}
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 text-muted-foreground" />
          <Slider
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={[history.present.scale]}
            onValueChange={onSlider}
            onValueCommit={onSliderCommit}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {history.present.scale.toFixed(2)}×
          </span>
        </div>

        {/* Bottom action row */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <XIcon className="mr-1 h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            <Check className="mr-1 h-4 w-4" />
            Save
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Drag to reposition · pinch / scroll / slider to zoom · Cmd+Z to undo
        </p>
      </DialogContent>
    </Dialog>
  );
}
