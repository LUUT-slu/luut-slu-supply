import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminCustomerDetail } from "@/hooks/useAdminCustomers";
import { format, formatDistanceToNow } from "date-fns";
import { WhatsAppActions } from "@/components/admin/customers/WhatsAppActions";
import { CustomerOrdersPanel } from "@/components/admin/customers/CustomerOrdersPanel";
import { CustomerTagsEditor } from "@/components/admin/customers/CustomerTagsEditor";
import { CustomerNotesPanel } from "@/components/admin/customers/CustomerNotesPanel";
import { CustomerDiscountsPanel } from "@/components/admin/customers/CustomerDiscountsPanel";
import { CustomerReferralsPanel } from "@/components/admin/customers/CustomerReferralsPanel";

export default function AdminCustomerDetail() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { data: customer, isLoading } = useAdminCustomerDetail(userId);

  if (isLoading) {
    return (
      <div className="container py-6 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Customer not found.</p>
        <Button variant="outline" onClick={() => navigate("/admin/customers")} className="mt-4">
          Back to customers
        </Button>
      </div>
    );
  }

  const initial = (customer.full_name || customer.email || "?").charAt(0).toUpperCase();
  const cleanPhone = customer.phone?.replace(/[^\d+]/g, "").replace(/^\+/, "");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/customers")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Customers</span>
          </Button>
          <Link to="/" className="ml-auto font-display text-base text-primary">
            Home
          </Link>
        </div>
      </header>

      <main className="container flex-1 py-4 md:py-6 max-w-4xl">
        {/* Header card */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-lg leading-tight truncate">
                  {customer.full_name || "Unnamed customer"}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant={customer.email ? "default" : "outline"} className="text-[10px] h-5">
                    {customer.email ? "Account" : "Guest"}
                  </Badge>
                  {customer.has_active_discount && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      Has discount
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  {customer.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> {customer.phone}
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> {customer.email}
                    </div>
                  )}
                  {customer.preferred_location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> {customer.preferred_location}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Orders</div>
                <div className="text-sm font-semibold">{customer.total_orders}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Spent</div>
                <div className="text-sm font-semibold">EC${customer.total_spent.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Joined</div>
                <div className="text-sm font-semibold">
                  {format(new Date(customer.created_at), "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Last contact</div>
                <div className="text-sm font-semibold">
                  {customer.last_contacted_at
                    ? formatDistanceToNow(new Date(customer.last_contacted_at), { addSuffix: true })
                    : "Never"}
                </div>
              </div>
            </div>

            {(cleanPhone || customer.email) && (
              <div className="flex gap-2 mt-4">
                {cleanPhone && (
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 h-10"
                    onClick={() => window.open(`https://wa.me/${cleanPhone}`, "_blank")}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                )}
                {customer.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 h-10"
                    onClick={() => (window.location.href = `mailto:${customer.email}`)}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full overflow-x-auto justify-start h-auto p-1 flex-nowrap">
            <TabsTrigger value="overview" className="text-xs px-3">Overview</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs px-3">Orders</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs px-3">WhatsApp</TabsTrigger>
            <TabsTrigger value="referrals" className="text-xs px-3">Referrals</TabsTrigger>
            <TabsTrigger value="discounts" className="text-xs px-3">Discounts</TabsTrigger>
            <TabsTrigger value="tags" className="text-xs px-3">Tags</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs px-3">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-3">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-2">Tags & interests</h3>
                {customer.tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tags yet. Add some in the Tags tab.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {customer.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {customer.meetup_notes && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-2">Customer meetup notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.meetup_notes}</p>
                </CardContent>
              </Card>
            )}
            {customer.last_order_at && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Last order</div>
                  <div className="text-sm font-medium">
                    {format(new Date(customer.last_order_at), "MMM d, yyyy")} (
                    {formatDistanceToNow(new Date(customer.last_order_at), { addSuffix: true })})
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <CustomerOrdersPanel userId={customer.user_id} email={customer.email} />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <WhatsAppActions
              userId={customer.user_id}
              name={customer.full_name}
              phone={customer.phone}
            />
          </TabsContent>

          <TabsContent value="referrals" className="mt-4">
            <CustomerReferralsPanel
              userId={customer.user_id}
              customerName={customer.full_name}
              customerPhone={customer.phone}
            />
          </TabsContent>

          <TabsContent value="discounts" className="mt-4">
            <CustomerDiscountsPanel userId={customer.user_id} />
          </TabsContent>

          <TabsContent value="tags" className="mt-4">
            <CustomerTagsEditor userId={customer.user_id} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <CustomerNotesPanel userId={customer.user_id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
