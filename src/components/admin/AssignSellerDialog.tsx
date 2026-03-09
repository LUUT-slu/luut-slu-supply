import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link2, Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssignSellerDialogProps {
  sellerId: string;
  sellerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

interface FoundProfile {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

export function AssignSellerDialog({
  sellerId,
  sellerName,
  open,
  onOpenChange,
  onAssigned,
}: AssignSellerDialogProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearched(true);

    try {
      // Search customer_profiles by email
      const { data, error } = await supabase
        .from("customer_profiles")
        .select("user_id, email, full_name")
        .ilike("email", `%${searchEmail.trim()}%`)
        .limit(10);

      if (error) throw error;
      setResults((data || []) as FoundProfile[]);
    } catch (err) {
      console.error(err);
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setAssigning(true);

    try {
      // Check if this user already has a seller profile
      const { data: existing } = await supabase
        .from("seller_profiles")
        .select("id, seller_name")
        .eq("user_id", selectedUserId)
        .neq("id", sellerId)
        .maybeSingle();

      if (existing) {
        toast.error(`This user is already linked to "${existing.seller_name}"`);
        setAssigning(false);
        return;
      }

      // Update the seller profile with the real user_id
      const { error } = await supabase
        .from("seller_profiles")
        .update({ user_id: selectedUserId })
        .eq("id", sellerId);

      if (error) throw error;

      toast.success(`${sellerName} assigned to user successfully`);
      onOpenChange(false);
      onAssigned();
      resetState();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to assign seller");
    } finally {
      setAssigning(false);
    }
  };

  const resetState = () => {
    setSearchEmail("");
    setResults([]);
    setSelectedUserId(null);
    setSearched(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign "{sellerName}" to User</DialogTitle>
          <DialogDescription>
            Search for a registered user by email and link this seller profile to them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Search by Email</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="user@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {searched && (
            <div className="space-y-2">
              {results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No users found matching that email
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {results.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => setSelectedUserId(user.user_id)}
                      className={`w-full text-left p-2 rounded-md border text-sm flex items-center gap-2 transition-colors ${
                        selectedUserId === user.user_id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{user.full_name || "No name"}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                      {selectedUserId === user.user_id && (
                        <Badge className="ml-auto shrink-0" variant="default">Selected</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!selectedUserId || assigning} className="gap-2">
            <Link2 className="h-4 w-4" />
            {assigning ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
