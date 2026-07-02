import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, RefreshCw, Eye, Check, X, Trash2, ShieldCheck, LogOut, Ban, Store, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { CreateSellerDialog } from "@/components/admin/CreateSellerDialog";
import { AssignSellerDialog } from "@/components/admin/AssignSellerDialog";

const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";

interface SellerProfile {
  id: string;
  user_id: string;
  seller_name: string;
  seller_id: string | null;
  whatsapp: string | null;
  phone: string | null;
  location: string | null;
  logo_url: string | null;
  is_approved: boolean;
  is_primary_seller: boolean | null;
  seller_status: string | null;
  created_at: string;
}

export default function AdminSellersNew() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignSeller, setAssignSeller] = useState<SellerProfile | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/seller-auth", { replace: true });
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const hasAdminRole = roles?.some(r => (r.role as string) === "admin");
    
    if (!hasAdminRole) {
      toast.error("Admin access required");
      navigate("/seller-auth", { replace: true });
      return;
    }

    setIsAdmin(true);
    setCheckingAuth(false);
    fetchSellers();
  };

  const fetchSellers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seller_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load sellers");
      console.error(error);
    } else {
      setSellers((data || []) as SellerProfile[]);
    }
    setLoading(false);
  };

  const handleApprove = async (seller: SellerProfile) => {
    const { error } = await supabase
      .from("seller_profiles")
      .update({ 
        is_approved: true, 
        seller_status: "approved",
        approved_at: new Date().toISOString()
      })
      .eq("id", seller.id);

    if (error) {
      toast.error("Failed to approve seller");
    } else {
      toast.success(`${seller.seller_name} approved`);
      fetchSellers();
    }
  };

  const handleReject = async () => {
    if (!selectedSeller) return;

    const { error } = await supabase
      .from("seller_profiles")
      .update({ 
        is_approved: false, 
        seller_status: "rejected"
      })
      .eq("id", selectedSeller.id);

    if (error) {
      toast.error("Failed to reject seller");
    } else {
      toast.success(`${selectedSeller.seller_name} rejected`);
      fetchSellers();
    }
    
    setRejectDialogOpen(false);
    setSelectedSeller(null);
    setRejectionReason("");
  };

  const handleSuspend = async (seller: SellerProfile) => {
    const { error } = await supabase
      .from("seller_profiles")
      .update({ 
        is_approved: false, 
        seller_status: "suspended"
      })
      .eq("id", seller.id);

    if (error) {
      toast.error("Failed to suspend seller");
    } else {
      toast.success(`${seller.seller_name} suspended`);
      fetchSellers();
    }
  };

  const handleDelete = async (seller: SellerProfile) => {
    const { error } = await supabase
      .from("seller_profiles")
      .delete()
      .eq("id", seller.id);

    if (error) {
      toast.error("Failed to delete seller");
      console.error(error);
    } else {
      toast.success(`${seller.seller_name} deleted`);
      fetchSellers();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const getStatusBadge = (seller: SellerProfile) => {
    if (seller.is_primary_seller) {
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Admin Seller</Badge>;
    }
    if (seller.seller_status === "approved" && seller.is_approved) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
    }
    if (seller.seller_status === "rejected") {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    if (seller.seller_status === "suspended") {
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Suspended</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Pending</Badge>;
  };

  const filteredSellers = sellers.filter(s => {
    if (activeTab === "pending") {
      return s.seller_status === "pending" && !s.is_approved;
    }
    if (activeTab === "approved") {
      return s.is_approved || s.seller_status === "approved";
    }
    if (activeTab === "rejected") {
      return s.seller_status === "rejected" || s.seller_status === "suspended";
    }
    return true;
  });

  const counts = {
    pending: sellers.filter(s => s.seller_status === "pending" && !s.is_approved).length,
    approved: sellers.filter(s => s.is_approved || s.seller_status === "approved").length,
    rejected: sellers.filter(s => s.seller_status === "rejected" || s.seller_status === "suspended").length,
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="font-display text-xl tracking-wide text-primary">
            Home
          </Link>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>
      
      <main className="container flex-1 py-4 md:py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton to="/admin" />
            <div>
              <h1 className="font-display text-xl md:text-2xl">Manage Sellers</h1>
              <p className="text-xs text-muted-foreground">
                {sellers.length} total sellers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchSellers} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <CreateSellerDialog onCreated={fetchSellers} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="pending" className="text-xs gap-1">
              Pending
              {counts.pending > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {counts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              Approved ({counts.approved})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              Rejected ({counts.rejected})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Sellers Table */}
        <div className="rounded-lg border border-border/60 bg-card/50">
          {loading ? (
            <div className="p-4"><ListItemSkeleton rows={5} /></div>
          ) : filteredSellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-medium text-sm">No sellers in this category</h3>
              <p className="text-xs text-muted-foreground">
                {activeTab === "pending" ? "No pending applications" : `No ${activeTab} sellers`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs w-12"></TableHead>
                    <TableHead className="text-xs">Seller</TableHead>
                    <TableHead className="text-xs">Contact</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Applied</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSellers.map((seller) => (
                    <TableRow key={seller.id} className="h-14">
                      <TableCell className="py-2">
                        {seller.logo_url ? (
                          <img
                            src={seller.logo_url}
                            alt={seller.seller_name}
                            className="h-10 w-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Store className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{seller.seller_name}</span>
                          {seller.user_id === PLACEHOLDER_USER_ID && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-dashed">
                              <Unlink className="h-2.5 w-2.5 mr-0.5" />
                              Unlinked
                            </Badge>
                          )}
                        </div>
                        {seller.location && (
                          <div className="text-xs text-muted-foreground">{seller.location}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {seller.phone || seller.whatsapp || "N/A"}
                      </TableCell>
                      <TableCell className="py-2">
                        {getStatusBadge(seller)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {new Date(seller.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/seller/${seller.seller_id || seller.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Assign to user (for unlinked profiles) */}
                          {seller.user_id === PLACEHOLDER_USER_ID && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => {
                                setAssignSeller(seller);
                                setAssignDialogOpen(true);
                              }}
                              title="Assign to user"
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          )}

                          
                          {!seller.is_primary_seller && (
                            <>
                              {/* Approve (for pending) */}
                              {activeTab === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                  onClick={() => handleApprove(seller)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Reject (for pending) */}
                              {activeTab === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedSeller(seller);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Suspend (for approved) */}
                              {activeTab === "approved" && !seller.is_primary_seller && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                  onClick={() => handleSuspend(seller)}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Reactivate (for rejected/suspended) */}
                              {activeTab === "rejected" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                  onClick={() => handleApprove(seller)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Seller?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove {seller.seller_name} from the platform.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(seller)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
        </div>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject {selectedSeller?.seller_name}'s application?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Seller Dialog */}
        {assignSeller && (
          <AssignSellerDialog
            sellerId={assignSeller.id}
            sellerName={assignSeller.seller_name}
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            onAssigned={fetchSellers}
          />
        )}
      </main>
    </div>
  );
}
