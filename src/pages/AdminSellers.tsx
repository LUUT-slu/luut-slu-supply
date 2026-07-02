import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Users, RefreshCw, Eye, Check, X, Trash2, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface SellerProfile {
  id: string;
  user_id: string;
  seller_name: string;
  seller_id: string | null;
  whatsapp: string | null;
  location: string | null;
  is_approved: boolean;
  is_primary_seller: boolean | null;
  seller_status: string | null;
  created_at: string;
}

export default function AdminSellers() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  const handleRevoke = async (seller: SellerProfile) => {
    const { error } = await supabase
      .from("seller_profiles")
      .update({ 
        is_approved: false, 
        seller_status: "revoked"
      })
      .eq("id", seller.id);

    if (error) {
      toast.error("Failed to revoke seller");
    } else {
      toast.success(`${seller.seller_name} access revoked`);
      fetchSellers();
    }
  };

  const handleDelete = async (seller: SellerProfile) => {
    // First try to delete from seller_profiles
    const { error } = await supabase
      .from("seller_profiles")
      .delete()
      .eq("id", seller.id);

    if (error) {
      toast.error("Failed to delete seller - may require database admin");
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
    if (seller.is_approved) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
    }
    if (seller.seller_status === "revoked") {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Revoked</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
  };

  const getRoleBadge = (seller: SellerProfile) => {
    if (seller.is_primary_seller) {
      return <Badge variant="outline" className="text-xs"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Seller</Badge>;
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const approvedCount = sellers.filter(s => s.is_approved).length;
  const pendingCount = sellers.filter(s => !s.is_approved && s.seller_status !== "revoked").length;

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
                {sellers.length} total · {approvedCount} approved · {pendingCount} pending
              </p>
            </div>
          </div>
          <Button onClick={fetchSellers} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Sellers Table */}
        <div className="rounded-lg border border-border/60 bg-card/50">
          {loading ? (
            <div className="p-4"><ListItemSkeleton rows={5} /></div>
          ) : sellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-medium text-sm">No sellers yet</h3>
              <p className="text-xs text-muted-foreground">Seller accounts will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Seller</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.map((seller) => (
                    <TableRow key={seller.id} className="h-12">
                      <TableCell className="py-2">
                        <div className="font-medium text-sm">{seller.seller_name}</div>
                        {seller.location && (
                          <div className="text-xs text-muted-foreground">{seller.location}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {getStatusBadge(seller)}
                      </TableCell>
                      <TableCell className="py-2">
                        {getRoleBadge(seller)}
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
                          
                          {/* Approve/Revoke - only for non-primary sellers */}
                          {!seller.is_primary_seller && (
                            <>
                              {!seller.is_approved ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                  onClick={() => handleApprove(seller)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                  onClick={() => handleRevoke(seller)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}

                          {/* Delete - only for non-primary sellers */}
                          {!seller.is_primary_seller && (
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
                                    This will permanently remove {seller.seller_name} from the platform. This action cannot be undone.
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
      </main>
    </div>
  );
}
