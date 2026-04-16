import { useState } from "react";
import { Sparkles, Loader2, Wand2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSellerAIInvoke } from "@/hooks/useSellerAI";
import { toast } from "sonner";

interface AIListingAssistantProps {
  productName: string;
  category: string;
  price: string;
  currentDescription: string;
  onApplyTitle?: (title: string) => void;
  onApplyDescription: (desc: string) => void;
}

const TONES = [
  { value: "streetwear", label: "Streetwear / Fashion" },
  { value: "professional", label: "Clean & Professional" },
  { value: "simple", label: "Simple & Direct" },
  { value: "premium", label: "Premium" },
];

export function AIListingAssistant({
  productName,
  category,
  price,
  currentDescription,
  onApplyTitle,
  onApplyDescription,
}: AIListingAssistantProps) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState("streetwear");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const { invoke, loading } = useSellerAIInvoke();

  const generateListing = async () => {
    if (!productName) {
      toast.error("Enter a product name first");
      return;
    }

    const prompt = `Generate a complete product listing for:
Product: ${productName}
${category ? `Category: ${category}` : ""}
${price ? `Price: EC$${price}` : ""}
${currentDescription ? `Current description (improve this): ${currentDescription}` : ""}

Tone: ${TONES.find(t => t.value === tone)?.label || tone}

Generate:
**Title:** (clean, searchable product title)
**Description:** (max 200 characters, appealing)
**Caption:** (short social media caption, 1 line)
**Features:**
- feature 1
- feature 2
- feature 3`;

    const response = await invoke(prompt, "listing", {
      productInfo: { name: productName, category, price },
    });
    if (response) setResult(response);
  };

  const generateDescriptionOnly = async () => {
    if (!productName) {
      toast.error("Enter a product name first");
      return;
    }

    const prompt = `Write a short, appealing product description (max 200 characters) for: ${productName}${category ? `, Category: ${category}` : ""}${price ? `, Price: EC$${price}` : ""}. Tone: ${tone}. Output ONLY the description text, nothing else.`;

    const response = await invoke(prompt, "listing", {
      productInfo: { name: productName, category, price },
    });
    if (response) {
      onApplyDescription(response.replace(/^["']|["']$/g, ""));
      toast.success("Description generated!");
    }
  };

  const rewriteDescription = async () => {
    if (!currentDescription) {
      toast.error("No description to rewrite");
      return;
    }

    const prompt = `Rewrite this product description in a ${tone} tone. Max 200 characters. Output ONLY the rewritten text:\n\n${currentDescription}`;
    const response = await invoke(prompt, "rewrite");
    if (response) {
      onApplyDescription(response.replace(/^["']|["']$/g, ""));
      toast.success("Description rewritten!");
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyDescription = () => {
    const match = result.match(/\*\*Description:\*\*\s*(.+?)(?:\n|$)/);
    if (match) {
      onApplyDescription(match[1].trim());
      toast.success("Description applied!");
    } else {
      toast.error("Could not extract description");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {open ? "Hide AI Listing Assistant" : "AI Listing Assistant"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3 rounded-lg border border-border/60 bg-card/50 p-3">
        {/* Tone selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Tone:</span>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5 text-xs flex-1"
            onClick={generateDescriptionOnly}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate Description
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5 text-xs flex-1"
            onClick={rewriteDescription}
            disabled={loading || !currentDescription}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Rewrite
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 text-xs w-full"
            onClick={generateListing}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate Full Listing
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <Textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={8}
              className="text-xs font-mono"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-1 text-xs flex-1" onClick={copyResult}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
              <Button type="button" size="sm" className="gap-1 text-xs flex-1" onClick={applyDescription}>
                <Sparkles className="h-3 w-3" />
                Apply Description
              </Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
