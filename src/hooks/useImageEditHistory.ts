import { useCallback, useRef, useState } from "react";
import type { CropState } from "@/lib/imageCropState";

const MAX_HISTORY = 50;

/**
 * Undo/redo stack for image crop edits.
 *
 * - `present`: the live crop state used for rendering.
 * - `push(state)`: commits a new state to the history (debounce externally).
 * - `set(state)`: updates `present` without touching history (use during drag).
 * - `undo()` / `redo()`: step through history, updating `present`.
 * - `reset(state)`: jumps to a baseline and clears the future stack.
 */
export function useImageEditHistory(initial: CropState) {
  const [present, setPresent] = useState<CropState>(initial);
  const past = useRef<CropState[]>([]);
  const future = useRef<CropState[]>([]);
  // Bump on every mutation so consumers re-render undo/redo button states.
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const push = useCallback(
    (next: CropState) => {
      setPresent((prev) => {
        // No-op if identical
        if (
          prev.scale === next.scale &&
          prev.offsetX === next.offsetX &&
          prev.offsetY === next.offsetY
        ) {
          return prev;
        }
        past.current.push(prev);
        if (past.current.length > MAX_HISTORY) past.current.shift();
        future.current = [];
        bump();
        return next;
      });
    },
    [],
  );

  const set = useCallback((next: CropState) => {
    setPresent(next);
  }, []);

  const undo = useCallback(() => {
    setPresent((prev) => {
      const last = past.current.pop();
      if (!last) return prev;
      future.current.push(prev);
      bump();
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setPresent((prev) => {
      const next = future.current.pop();
      if (!next) return prev;
      past.current.push(prev);
      bump();
      return next;
    });
  }, []);

  const reset = useCallback((baseline: CropState) => {
    past.current = [];
    future.current = [];
    setPresent(baseline);
    bump();
  }, []);

  return {
    present,
    set,
    push,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
