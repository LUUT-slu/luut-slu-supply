import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Users, RefreshCw, Eye, Check, X, Trash2, LogOut, Ban, Store, Pencil } from "lucide-react";
import { toast } from "sonner";

const LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort", "Rodney Bay", "Soufriere", "Other"];
const CATEGORIES = ["Clothing", "Accessories", "Shoes", "Bags", "Electronics", "Beauty", "Home", "Other"];

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
  shop_description: string | null;
  instagram_url: string | null;
  categories: string[] | null;
  owner_first_name: string | null;
  owner_email: string | null;
  facebook_url: string | null;
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSeller, setEditSeller] = useState<SellerProfile | null>(null);
  const [editForm, setEditForm] = useState({
    seller_name: "",
    shop_description: "",
    location: "",
    phone: "",
    whatsapp: "",
    instagram_url: "",
    facebook_url: "",
    categories: "" as string,
    owner_first_name: "",
    owner_email: "",
  });
  const [editSaving, setEditSaving] = useState(false);

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
      setSellers((data || []) as unknown as SellerProfile[]);
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

  const openEditDialog = (seller: SellerProfile) => {
    setEditSeller(seller);
    setEditForm({
      seller_name: seller.seller_name || "",
      shop_description: seller.shop_description || "",
      location: seller.location || "",
      phone: seller.phone || "",
      whatsapp: seller.whatsapp || "",
      instagram_url: seller.instagram_url || "",
      facebook_url: seller.facebook_url || "",
      categories: (seller.categories || []).join(", "),
      owner_first_name: seller.owner_first_name || "",
      owner_email: seller.owner_email || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editSeller) return;
    setEditSaving(true);

    const categoriesArray = editForm.categories
      .split(",")
      .map(c => c.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("seller_profiles")
      .update({
        seller_name: editForm.seller_name,
        shop_description: editForm.shop_description || null,
        location: editForm.location || null,
        phone: editForm.phone || null,
        whatsapp: editForm.whatsapp || null,
        instagram_url: editForm.instagram_url || null,
        facebook_url: editForm.facebook_url,
        categories: categoriesArray.length > 0 ? categoriesArray : null,
        owner_first_name: editForm.owner_first_name,
        owner_email: editForm.owner_email,
      } as any)
      .eq("id", editSeller.id);

    if (error) {
      toast.error("Failed to save changes");
      console.error(error);
    } else {
      toast.success("Seller profile updated");
      setEditDialogOpen(false);
      fetchSellers();
    }
    setEditSaving(false);
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
          <Button onClick={fetchSellers} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
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
                    <TableHead className="text-xs">Owner</TableHead>
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
                        <div className="font-medium text-sm">{seller.seller_name}</div>
                        {seller.location && (
                          <div className="text-xs text-muted-foreground">{seller.location}</div>
                        )}
                        {seller.instagram_url && (
                          <a href={seller.instagram_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                            Instagram
                          </a>
                        )}
                        {seller.facebook_url && (
                          <>
                            {" · "}
                            <a href={seller.facebook_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                              Facebook
                            </a>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="text-sm">{seller.owner_first_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{seller.owner_email || "—"}</div>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {seller.whatsapp || seller.phone || "N/A"}
                      </TableCell>
                      <TableCell className="py-2">
                        {getStatusBadge(seller)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {new Date(seller.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(seller)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          {/* View */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/seller/${seller.seller_id || seller.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Actions based on status */}
                          {!seller.is_primary_seller && (
                            <>
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

        {/* Edit Seller Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Seller Profile</DialogTitle>
              <DialogDescription>
                Update {editSeller?.seller_name}'s profile details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner First Name</Label>
                  <Input
                    value={editForm.owner_first_name}
                    onChange={(e) => setEditForm({ ...editForm, owner_first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Email</Label>
                  <Input
                    type="email"
                    value={editForm.owner_email}
                    onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Shop Name</Label>
                <Input
                  value={editForm.seller_name}
                  onChange={(e) => setEditForm({ ...editForm, seller_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editForm.shop_description}
                  onChange={(e) => setEditForm({ ...editForm, shop_description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={editForm.location}
                  onValueChange={(value) => setEditForm({ ...editForm, location: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Instagram URL</Label>
                <Input
                  value={editForm.instagram_url}
                  onChange={(e) => setEditForm({ ...editForm, instagram_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook URL</Label>
                <Input
                  value={editForm.facebook_url}
                  onChange={(e) => setEditForm({ ...editForm, facebook_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categories (comma-separated)</Label>
                <Input
                  value={editForm.categories}
                  onChange={(e) => setEditForm({ ...editForm, categories: e.target.value })}
                  placeholder="Clothing, Shoes, Accessories"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
