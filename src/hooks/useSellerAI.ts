import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type AIMode = "listing" | "order" | "rewrite" | "general";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-seller-assistant`;

async function streamSellerAI({
  messages,
  mode,
  context,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: Msg[];
  mode: AIMode;
  context?: Record<string, unknown>;
  onDelta: (t: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  signal?: AbortSignal;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { onError("Not authenticated"); return; }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages, mode, context, stream: true }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(err.error || `Request failed (${resp.status})`);
    return;
  }
  if (!resp.body) { onError("No stream"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const c = JSON.parse(json).choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { /* partial */ }
    }
  }
  onDone();
}

async function invokeSellerAI({
  messages,
  mode,
  context,
}: {
  messages: Msg[];
  mode: AIMode;
  context?: Record<string, unknown>;
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages, mode, context, stream: false }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `Request failed (${resp.status})`);
  }

  const data = await resp.json();
  return data.content || "";
}

export function useSellerAIChat(mode: AIMode = "general") {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string, context?: Record<string, unknown>) => {
    if (!text.trim() || loading) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    abortRef.current = new AbortController();
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamSellerAI({
      messages: [...messages, userMsg],
      mode,
      context,
      onDelta: upsert,
      onDone: () => setLoading(false),
      onError: (err) => {
        setLoading(false);
        toast.error(err);
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
      },
      signal: abortRef.current.signal,
    });
  }, [messages, loading, mode]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  }, []);

  return { messages, loading, send, clear, setMessages };
}

export function useSellerAIInvoke() {
  const [loading, setLoading] = useState(false);

  const invoke = useCallback(async (
    prompt: string,
    mode: AIMode = "listing",
    context?: Record<string, unknown>,
  ): Promise<string> => {
    setLoading(true);
    try {
      const result = await invokeSellerAI({
        messages: [{ role: "user", content: prompt }],
        mode,
        context,
      });
      return result;
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
      return "";
    } finally {
      setLoading(false);
    }
  }, []);

  return { invoke, loading };
}
