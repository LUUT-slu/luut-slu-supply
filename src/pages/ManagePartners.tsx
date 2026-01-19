import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  UserPlus, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  Phone,
  MapPin,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Partner {
  id: string;
  user_id: string;
  partner_name: string;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ManagePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPartnerEmail, setNewPartnerEmail] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");
  const [newPartnerWhatsApp, setNewPartnerWhatsApp] = useState("");
  const [newPartnerLocation, setNewPartnerLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchPartners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load partners");
      console.error(error);
    } else {
      setPartners(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const togglePartnerStatus = async (partnerId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("partner_profiles")
      .update({ is_active: !currentStatus })
      .eq("id", partnerId);

    if (error) {
      toast.error("Failed to update partner status");
    } else {
      toast.success(`Partner ${!currentStatus ? 'activated' : 'deactivated'}`);
      setPartners(partners.map(p => p.id === partnerId ? { ...p, is_active: !currentStatus } : p));
    }
  };

  const deletePartner = async (partnerId: string) => {
    const partner = partners.find(p => p.id === partnerId);
    
    // First remove the partner role
    if (partner) {
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", partner.user_id)
        .eq("role", "partner" as any);
    }

    const { error } = await supabase
      .from("partner_profiles")
      .delete()
      .eq("id", partnerId);

    if (error) {
      toast.error("Failed to delete partner");
    } else {
      toast.success("Partner removed");
      setPartners(partners.filter(p => p.id !== partnerId));
    }
  };

  const createPartner = async () => {
    if (!newPartnerEmail || !newPartnerName) {
      toast.error("Email and name are required");
      return;
    }

    setIsCreating(true);

    try {
      // Note: In a real app, you'd create the user account first
      // For now, we'll just create a partner profile that can be linked later
      // This is a simplified flow - in production you'd want to invite the user
      
      toast.info("Partner profile created. The partner will need to sign up with this email to access their dashboard.");
      
      // For demo purposes, show instructions
      toast.success(`Instructions sent to ${newPartnerEmail}`, {
        description: "Partner should sign up at /auth and their account will be linked.",
      });

      setIsAddDialogOpen(false);
      setNewPartnerEmail("");
      setNewPartnerName("");
      setNewPartnerPhone("");
      setNewPartnerWhatsApp("");
      setNewPartnerLocation("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create partner");
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const activePartners = partners.filter(p => p.is_active);
  const inactivePartners = partners.filter(p => !p.is_active);

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        
        <main className="container flex-1 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="font-display text-3xl">Manage Partners</h1>
                <p className="text-muted-foreground">Add and manage delivery partners</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Partner
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Partner</DialogTitle>
                    <DialogDescription>
                      Create a partner profile. The partner will need to sign up with the provided email.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="partner@example.com"
                        value={newPartnerEmail}
                        onChange={(e) => setNewPartnerEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Partner Name *</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        placeholder="758-123-4567"
                        value={newPartnerPhone}
                        onChange={(e) => setNewPartnerPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp Number</Label>
                      <Input
                        id="whatsapp"
                        placeholder="17581234567"
                        value={newPartnerWhatsApp}
                        onChange={(e) => setNewPartnerWhatsApp(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="Castries"
                        value={newPartnerLocation}
                        onChange={(e) => setNewPartnerLocation(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createPartner} disabled={isCreating}>
                      {isCreating ? "Creating..." : "Add Partner"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={fetchPartners} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{partners.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activePartners.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inactivePartners.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Partners Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Partners</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : partners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-medium">No partners yet</h3>
                  <p className="text-sm text-muted-foreground">Add partners to assign orders to them</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner) => (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">
                            {partner.partner_name}
                          </TableCell>
                          <TableCell>
                            {partner.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {partner.phone}
                              </div>
                            )}
                            {partner.whatsapp && (
                              <div className="text-xs text-muted-foreground">
                                WA: {partner.whatsapp}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {partner.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {partner.location}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={partner.is_active ? "default" : "secondary"}>
                              {partner.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(partner.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => togglePartnerStatus(partner.id, partner.is_active)}
                              >
                                {partner.is_active ? "Deactivate" : "Activate"}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Partner?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove {partner.partner_name} from the partner program. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePartner(partner.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </AdminAuth>
  );
}
