import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Plus, Pencil, Trash2, RefreshCw, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Seller {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    location: "",
    description: "",
    is_active: true,
  });

  const fetchSellers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("verified_sellers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load sellers");
      console.error(error);
    } else {
      setSellers((data || []) as Seller[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      whatsapp: "",
      location: "",
      description: "",
      is_active: true,
    });
    setEditingSeller(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (seller: Seller) => {
    setEditingSeller(seller);
    setFormData({
      name: seller.name,
      phone: seller.phone || "",
      whatsapp: seller.whatsapp || "",
      location: seller.location || "",
      description: seller.description || "",
      is_active: seller.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const sellerData = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      whatsapp: formData.whatsapp.trim() || null,
      location: formData.location.trim() || null,
      description: formData.description.trim() || null,
      is_active: formData.is_active,
    };

    if (editingSeller) {
      const { error } = await supabase
        .from("verified_sellers")
        .update(sellerData)
        .eq("id", editingSeller.id);

      if (error) {
        toast.error("Failed to update seller");
      } else {
        toast.success("Seller updated");
        fetchSellers();
      }
    } else {
      const { error } = await supabase
        .from("verified_sellers")
        .insert(sellerData);

      if (error) {
        toast.error("Failed to add seller");
      } else {
        toast.success("Seller added");
        fetchSellers();
      }
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this seller?")) return;

    const { error } = await supabase
      .from("verified_sellers")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete seller");
    } else {
      toast.success("Seller deleted");
      fetchSellers();
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("verified_sellers")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update seller status");
    } else {
      setSellers(sellers.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
    }
  };

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        
        <main className="container flex-1 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton to="/admin" label="Admin Hub" />
              <div>
                <h1 className="font-display text-3xl">Verified Sellers</h1>
                <p className="text-muted-foreground">Manage your trusted seller network</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/admin">Orders</Link>
              </Button>
              <Button onClick={fetchSellers} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Seller
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingSeller ? "Edit Seller" : "Add New Seller"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seller name"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+1 758 XXX XXXX"
                        />
                      </div>
                      <div>
                        <Label htmlFor="whatsapp">WhatsApp</Label>
                        <Input
                          id="whatsapp"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          placeholder="17587185478"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Castries, St. Lucia"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of seller..."
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingSeller ? "Update" : "Add"} Seller
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Sellers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sellers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sellers.filter(s => s.is_active).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                <Users className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sellers.filter(s => !s.is_active).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sellers Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Sellers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sellers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-medium">No sellers yet</h3>
                  <p className="text-sm text-muted-foreground">Add your first verified seller</p>
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
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellers.map((seller) => (
                        <TableRow key={seller.id}>
                          <TableCell>
                            <div className="font-medium">{seller.name}</div>
                            {seller.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {seller.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {seller.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {seller.phone}
                              </div>
                            )}
                            {seller.whatsapp && (
                              <a
                                href={`https://wa.me/${seller.whatsapp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                WhatsApp
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            {seller.location && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                {seller.location}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={seller.is_active ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => toggleActive(seller.id, seller.is_active)}
                            >
                              {seller.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(seller)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(seller.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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

        <Footer />
      </div>
    </AdminAuth>
  );
}
