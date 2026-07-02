import { useState, useEffect } from "react";
import { ListItemSkeleton } from "@/components/skeletons/TableSkeleton";
import { useNavigate, Link } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Users, 
  RefreshCw, 
  Eye,
  ClipboardList,
  Phone,
  MapPin,
  Trash2,
  LogOut,
  Package,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AssignOrderModal } from "@/components/admin/AssignOrderModal";

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

interface PartnerWithStats extends Partner {
  assignedCount: number;
  completedCount: number;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  status: string;
  total_price: number;
  currency_code: string;
  assigned_partner_id: string | null;
}

export default function ManagePartners() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<PartnerWithStats[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerWithStats | null>(null);
  
  // Modal for assigning with commission
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [orderToAssign, setOrderToAssign] = useState<Order | null>(null);

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
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch partners
    const { data: partnersData, error: partnersError } = await supabase
      .from("partner_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (partnersError) {
      toast.error("Failed to load partners");
      console.error(partnersError);
      setLoading(false);
      return;
    }

    // Fetch all orders to calculate stats
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, status, assigned_partner_id, total_price, currency_code");

    const orders = (ordersData || []) as Order[];
    
    // Calculate stats for each partner
    const partnersWithStats: PartnerWithStats[] = (partnersData || []).map(partner => {
      const partnerOrders = orders.filter(o => o.assigned_partner_id === partner.user_id);
      return {
        ...partner,
        assignedCount: partnerOrders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status)).length,
        completedCount: partnerOrders.filter(o => o.status === "COMPLETED").length,
      };
    });

    setPartners(partnersWithStats);
    
    // Get unassigned orders (NEW status, no partner)
    const unassigned = orders.filter(o => 
      !o.assigned_partner_id && ["NEW", "pending", "new"].includes(o.status.toUpperCase() === "NEW" ? o.status : o.status)
    );
    setUnassignedOrders(unassigned.filter(o => !o.assigned_partner_id));
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const togglePartnerStatus = async (partnerId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("partner_profiles")
      .update({ is_active: !currentStatus })
      .eq("id", partnerId);

    if (error) {
      toast.error("Failed to update partner status");
    } else {
      toast.success(`Partner ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchData();
    }
  };

  const deletePartner = async (partner: PartnerWithStats) => {
    // Remove the partner role
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", partner.user_id)
      .eq("role", "partner" as any);

    const { error } = await supabase
      .from("partner_profiles")
      .delete()
      .eq("id", partner.id);

    if (error) {
      toast.error("Failed to delete partner");
    } else {
      toast.success("Partner removed");
      fetchData();
    }
  };

  const openAssignDialog = (partner: PartnerWithStats) => {
    setSelectedPartner(partner);
    setAssignDialogOpen(true);
  };

  const openAssignModalForOrder = (orderId: string) => {
    if (!selectedPartner) return;
    const order = unassignedOrders.find(o => o.id === orderId);
    if (order) {
      setOrderToAssign(order);
      setAssignDialogOpen(false);
      setAssignModalOpen(true);
    }
  };

  const handleOrderAssigned = () => {
    setAssignModalOpen(false);
    setOrderToAssign(null);
    fetchData();
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const activePartners = partners.filter(p => p.is_active);

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
              <h1 className="font-display text-xl md:text-2xl">Partner Management</h1>
              <p className="text-xs text-muted-foreground">
                {partners.length} partners · {activePartners.length} active · {unassignedOrders.length} unassigned orders
              </p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Partners Table */}
        <div className="rounded-lg border border-border/60 bg-card/50">
          {loading ? (
            <div className="p-4"><ListItemSkeleton rows={5} /></div>
          ) : partners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-medium text-sm">No partners yet</h3>
              <p className="text-xs text-muted-foreground">Partner accounts will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Partner</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-center">Active Orders</TableHead>
                    <TableHead className="text-xs text-center">Completed</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id} className="h-12">
                      <TableCell className="py-2">
                        <div className="font-medium text-sm">{partner.partner_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {partner.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {partner.phone}
                            </span>
                          )}
                          {partner.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {partner.location}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge 
                          variant={partner.is_active ? "default" : "secondary"}
                          className={partner.is_active ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}
                        >
                          {partner.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="h-3 w-3 text-blue-500" />
                          <span className="font-medium">{partner.assignedCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="font-medium">{partner.completedCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Partner */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/admin/partners/${partner.user_id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Assign Order */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                            onClick={() => openAssignDialog(partner)}
                            disabled={unassignedOrders.length === 0}
                          >
                            <ClipboardList className="h-4 w-4" />
                          </Button>

                          {/* Toggle Status */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => togglePartnerStatus(partner.id, partner.is_active)}
                          >
                            {partner.is_active ? "Deactivate" : "Activate"}
                          </Button>

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
                                <AlertDialogTitle>Remove Partner?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {partner.partner_name} from the partner program. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePartner(partner)}
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
        </div>
      </main>

      {/* Assign Order Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Order to {selectedPartner?.partner_name}</DialogTitle>
            <DialogDescription>
              Select an unassigned order to assign to this partner.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {unassignedOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No unassigned orders available
              </p>
            ) : (
              unassignedOrders.map((order) => (
                <Button
                  key={order.id}
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  onClick={() => openAssignModalForOrder(order.id)}
                >
                  <span className="font-medium">
                    #L{String(order.order_number).padStart(4, '0')}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {order.customer_name} · EC${order.total_price?.toFixed(2) || '0.00'}
                  </span>
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Modal with Commission */}
      {orderToAssign && selectedPartner && (
        <AssignOrderModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          orderId={orderToAssign.id}
          orderNumber={orderToAssign.order_number}
          orderTotal={orderToAssign.total_price || 0}
          currencyCode={orderToAssign.currency_code || "XCD"}
          partners={[{
            user_id: selectedPartner.user_id,
            partner_name: selectedPartner.partner_name,
            phone: selectedPartner.phone,
            whatsapp: selectedPartner.whatsapp,
            is_active: selectedPartner.is_active
          }]}
          onAssigned={handleOrderAssigned}
        />
      )}
    </div>
  );
}
