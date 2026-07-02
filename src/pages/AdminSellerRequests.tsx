import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";

import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  RefreshCw,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  MapPin,
  MessageCircle,
  Eye,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SellerApplication {
  id: string;
  user_id: string;
  name: string;
  whatsapp: string;
  location: string | null;
  categories: string[] | null;
  proof_url: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  business_name: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  secondary_phone: string | null;
  email: string | null;
  tiktok_url: string | null;
}

type StatusFilter = "pending" | "approved" | "rejected" | "banned" | "all";

export default function AdminSellerRequests() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusFilter>("pending");
  const [selectedApp, setSelectedApp] = useState<SellerApplication | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load applications");
      console.error(error);
    } else {
      setApplications(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const filteredApplications = applications.filter((app) =>
    activeTab === "all" ? true : app.status === activeTab
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "approved":
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      case "banned":
        return <Badge variant="destructive" className="gap-1 bg-red-800"><Ban className="h-3 w-3" />Banned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApprove = async (app: SellerApplication) => {
    setProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update application status
      const { error: appError } = await supabase
        .from("seller_applications")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);

      if (appError) throw appError;

      // Check if seller profile exists
      const { data: existingProfile } = await supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", app.user_id)
        .maybeSingle();

      if (existingProfile) {
        // Update existing profile
        const { error: profileError } = await supabase
          .from("seller_profiles")
          .update({
            is_approved: true,
            seller_status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: user.id,
          })
          .eq("user_id", app.user_id);

        if (profileError) throw profileError;
      } else {
        // Create new seller profile
        const sellerId = `S${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const { error: profileError } = await supabase
          .from("seller_profiles")
          .insert({
            user_id: app.user_id,
            seller_name: app.name,
            whatsapp: app.whatsapp,
            location: app.location,
            seller_id: sellerId,
            is_approved: true,
            seller_status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: user.id,
          });

        if (profileError) throw profileError;
      }

      // Add seller role - first check if exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", app.user_id)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: app.user_id,
            role: "user" as const, // Default role
          });
        if (roleError) console.error("Role assignment error:", roleError);
      }

      toast.success(`${app.name} approved as seller!`);
      fetchApplications();
      setDetailsOpen(false);
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Failed to approve seller");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("seller_applications")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason.trim(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedApp.id);

      if (error) throw error;

      // Update seller profile if exists
      await supabase
        .from("seller_profiles")
        .update({
          is_approved: false,
          seller_status: "rejected",
        })
        .eq("user_id", selectedApp.user_id);

      toast.success(`${selectedApp.name}'s application rejected`);
      fetchApplications();
      setRejectDialogOpen(false);
      setDetailsOpen(false);
      setRejectionReason("");
    } catch (error) {
      console.error("Reject error:", error);
      toast.error("Failed to reject application");
    } finally {
      setProcessing(false);
    }
  };

  const handleBan = async (app: SellerApplication) => {
    if (!confirm(`Ban ${app.name}? This will permanently prevent them from becoming a seller.`)) return;

    setProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("seller_applications")
        .update({
          status: "banned",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);

      if (error) throw error;

      // Update seller profile if exists
      await supabase
        .from("seller_profiles")
        .update({
          is_approved: false,
          seller_status: "banned",
        })
        .eq("user_id", app.user_id);

      toast.success(`${app.name} has been banned`);
      fetchApplications();
      setDetailsOpen(false);
    } catch (error) {
      console.error("Ban error:", error);
      toast.error("Failed to ban seller");
    } finally {
      setProcessing(false);
    }
  };

  const counts = {
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
    banned: applications.filter((a) => a.status === "banned").length,
  };

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        <main className="container flex-1 py-8">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BackButton to="/admin" label="Admin Hub" />
              <div>
                <h1 className="font-display text-2xl md:text-3xl">Seller Requests</h1>
                <p className="text-sm text-muted-foreground">
                  Review and manage seller applications
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/")} variant="outline" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
              <Button onClick={fetchApplications} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab("pending")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.pending}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab("approved")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.approved}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab("rejected")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.rejected}</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab("banned")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Banned</CardTitle>
                <Ban className="h-4 w-4 text-red-800" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.banned}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusFilter)}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <Card>
                <CardContent className="pt-6">
                  {loading ? (
                    <ListItemSkeleton rows={5} />
                  ) : filteredApplications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="font-medium">No applications</h3>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === "pending"
                          ? "No pending seller requests"
                          : `No ${activeTab} applications`}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Applied</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredApplications.map((app) => (
                            <TableRow key={app.id}>
                              <TableCell>
                                <div className="font-medium">{app.name}</div>
                                {app.business_name && (
                                  <div className="text-xs text-muted-foreground">{app.business_name}</div>
                                )}
                                {app.categories && app.categories.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {app.categories.slice(0, 2).map((cat) => (
                                      <Badge key={cat} variant="outline" className="text-xs">
                                        {cat}
                                      </Badge>
                                    ))}
                                    {app.categories.length > 2 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{app.categories.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <a
                                  href={`https://wa.me/${app.whatsapp}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                  WhatsApp
                                </a>
                              </TableCell>
                              <TableCell>
                                {app.location && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <MapPin className="h-3 w-3" />
                                    {app.location}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(app.status)}</TableCell>
                              <TableCell>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(app.created_at), "MMM d, yyyy")}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedApp(app);
                                      setDetailsOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {app.status === "pending" && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-green-500 hover:text-green-600"
                                        onClick={() => handleApprove(app)}
                                        disabled={processing}
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600"
                                        onClick={() => {
                                          setSelectedApp(app);
                                          setRejectDialogOpen(true);
                                        }}
                                        disabled={processing}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
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
            </TabsContent>
          </Tabs>
        </main>

        {/* Application Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>
                Review seller application
              </DialogDescription>
            </DialogHeader>
            {selectedApp && (
            <div className="overflow-y-auto flex-1 pr-2">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="font-medium">{selectedApp.name}</p>
                </div>
                {selectedApp.business_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Business Name</label>
                    <p className="font-medium">{selectedApp.business_name}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone / WhatsApp</label>
                  <p>{selectedApp.whatsapp}</p>
                </div>
                {selectedApp.secondary_phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                    <p>{selectedApp.secondary_phone}</p>
                  </div>
                )}
                {selectedApp.email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p>{selectedApp.email}</p>
                  </div>
                )}
                {selectedApp.location && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p>{selectedApp.location}</p>
                  </div>
                )}
                {selectedApp.instagram_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Instagram</label>
                    <p>
                      <a href={selectedApp.instagram_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {selectedApp.instagram_url}
                      </a>
                    </p>
                  </div>
                )}
                {selectedApp.facebook_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Facebook</label>
                    <p>
                      <a href={selectedApp.facebook_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {selectedApp.facebook_url}
                      </a>
                    </p>
                  </div>
                )}
                {selectedApp.tiktok_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">TikTok</label>
                    <p>
                      <a href={selectedApp.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {selectedApp.tiktok_url}
                      </a>
                    </p>
                  </div>
                )}
                {selectedApp.categories && selectedApp.categories.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Categories</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedApp.categories.map((cat) => (
                        <Badge key={cat} variant="outline">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedApp.proof_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Proof/Portfolio</label>
                    <p>
                      <a href={selectedApp.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        View Link
                      </a>
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Applied</label>
                  <p>{format(new Date(selectedApp.created_at), "PPp")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                </div>
                {selectedApp.rejection_reason && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rejection Reason</label>
                    <p className="text-destructive">{selectedApp.rejection_reason}</p>
                  </div>
                )}
                {/* WhatsApp Message Button */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const phone = selectedApp.whatsapp.replace(/[^0-9]/g, "");
                    const msg = `Hi ${selectedApp.name}, regarding your seller application on Luut — we'd like to clarify a few details. Could you help us with that?`;
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Message on WhatsApp
                </Button>
              </div>
            </div>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row border-t pt-4 mt-2">
              {selectedApp?.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    className="text-red-500 border-red-500 hover:bg-red-500/10"
                    onClick={() => handleBan(selectedApp)}
                    disabled={processing}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Ban
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-500"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="bg-green-500 hover:bg-green-600"
                    onClick={() => handleApprove(selectedApp)}
                    disabled={processing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
              {selectedApp?.status !== "pending" && (
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Reason Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting {selectedApp?.name}'s application.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
              >
                {processing ? "Rejecting..." : "Reject Application"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminAuth>
  );
}
