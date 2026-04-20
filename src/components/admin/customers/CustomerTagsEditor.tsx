import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
}

interface TagRow {
  id: string;
  tag: string;
  tag_type: string;
}

export function CustomerTagsEditor({ userId }: Props) {
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState("");
  const [newInterest, setNewInterest] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-customer-tags", userId],
    queryFn: async (): Promise<TagRow[]> => {
      const { data } = await supabase
        .from("customer_tags")
        .select("id, tag, tag_type")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const tags = rows.filter((r) => r.tag_type === "tag");
  const interests = rows.filter((r) => r.tag_type === "interest");

  const add = async (value: string, type: "tag" | "interest") => {
    const v = value.trim();
    if (!v) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_tags").insert({
      user_id: userId,
      tag: v,
      tag_type: type,
      created_by: user?.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("Already added");
      else toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-customer-tags", userId] });
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
    if (type === "tag") setNewTag("");
    else setNewInterest("");
  };

  const remove = async (id: string) => {
    await supabase.from("customer_tags").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-customer-tags", userId] });
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-medium mb-2">Tags</h3>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-8">
          {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet.</span>}
          {tags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1 pr-1 h-7">
              {t.tag}
              <button onClick={() => remove(t.id)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add(newTag, "tag")}
            placeholder="e.g. VIP, repeat"
            className="h-10"
          />
          <Button onClick={() => add(newTag, "tag")} size="sm" className="h-10 gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-2">Product interests</h3>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-8">
          {interests.length === 0 && (
            <span className="text-xs text-muted-foreground">No interests recorded.</span>
          )}
          {interests.map((t) => (
            <Badge key={t.id} variant="outline" className="gap-1 pr-1 h-7">
              {t.tag}
              <button onClick={() => remove(t.id)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add(newInterest, "interest")}
            placeholder="e.g. ski masks, beanies"
            className="h-10"
          />
          <Button onClick={() => add(newInterest, "interest")} size="sm" className="h-10 gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>
    </div>
  );
}
