import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
}

interface Note {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
}

export function CustomerNotesPanel({ userId }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ["admin-customer-notes", userId],
    queryFn: async (): Promise<Note[]> => {
      const { data } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const add = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("customer_notes").insert({
      user_id: userId,
      note: text.trim(),
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    qc.invalidateQueries({ queryKey: ["admin-customer-notes", userId] });
    toast.success("Note added");
  };

  const remove = async (id: string) => {
    await supabase.from("customer_notes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-customer-notes", userId] });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an internal note (admin-only)…"
          rows={3}
        />
        <Button onClick={add} disabled={!text.trim() || submitting} className="w-full h-10">
          Add note
        </Button>
      </div>

      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="rounded-md border border-border bg-card p-3">
            <p className="text-sm whitespace-pre-wrap">{n.note}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
              <button
                onClick={() => remove(n.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
