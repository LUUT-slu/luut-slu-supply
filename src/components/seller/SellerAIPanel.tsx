import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Sparkles, ShoppingBag, Package, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSellerAIChat } from "@/hooks/useSellerAI";

type AIMode = "general" | "listing" | "order";

const MODE_CONFIG = {
  general: {
    icon: Bot,
    label: "Assistant",
    placeholder: "Ask about selling tips, pricing, photos...",
    welcome: "I'm your Luut selling assistant. Ask me anything about improving your store, creating better listings, or growing your sales.",
  },
  listing: {
    icon: Package,
    label: "Listings",
    placeholder: "Describe a product to generate a listing...",
    welcome: "I'll help you create compelling product listings. Tell me about your product — name, category, price — and I'll generate titles, descriptions, and features.",
  },
  order: {
    icon: ShoppingBag,
    label: "Orders",
    placeholder: "Ask about your orders, draft messages...",
    welcome: "I can summarize your orders, identify ones needing action, and draft customer messages. Try: \"Show me pending orders\" or \"Draft a pickup reminder\".",
  },
};

interface SellerAIPanelProps {
  defaultMode?: AIMode;
}

export function SellerAIPanel({ defaultMode = "general" }: SellerAIPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AIMode>(defaultMode);
  const [input, setInput] = useState("");
  const { messages, loading, send, clear } = useSellerAIChat(mode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send(text);
  };

  const handleModeChange = (newMode: string) => {
    if (newMode !== mode) {
      clear();
      setMode(newMode as AIMode);
    }
  };

  const config = MODE_CONFIG[mode];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="AI Assistant"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">AI Assistant</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col bg-background border border-border shadow-2xl rounded-2xl overflow-hidden",
        isMobile ? "inset-2" : "bottom-6 left-6 w-[420px] h-[580px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Seller AI</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clear} title="Clear chat">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="px-3 py-2 border-b border-border">
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            {(Object.entries(MODE_CONFIG) as [AIMode, typeof MODE_CONFIG["general"]][]).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key} className="text-xs gap-1.5 data-[state=active]:bg-primary/10">
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-6">
            <config.icon className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-xs leading-relaxed max-w-[280px] mx-auto">{config.welcome}</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick actions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {mode === "general" && (
            <>
              <QuickAction onClick={() => { setInput("How can I improve my listings?"); }} label="Improve listings" />
              <QuickAction onClick={() => { setInput("Tips for better product photos"); }} label="Photo tips" />
              <QuickAction onClick={() => { setInput("How should I price my products?"); }} label="Pricing help" />
            </>
          )}
          {mode === "listing" && (
            <>
              <QuickAction onClick={() => { setInput("Generate a listing for a black beanie, EC$45"); }} label="Sample listing" />
              <QuickAction onClick={() => { setInput("Rewrite this description in a premium tone"); }} label="Rewrite premium" />
            </>
          )}
          {mode === "order" && (
            <>
              <QuickAction onClick={() => { setInput("Show me orders needing confirmation"); }} label="Pending orders" />
              <QuickAction onClick={() => { setInput("Draft a pickup reminder for my next order"); }} label="Pickup reminder" />
              <QuickAction onClick={() => { setInput("Summarize today's order activity"); }} label="Today's summary" />
            </>
          )}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex items-center gap-2 border-t border-border px-3 py-3"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={config.placeholder}
          className="flex-1 text-sm"
          disabled={loading}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function QuickAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
    >
      {label}
    </button>
  );
}
