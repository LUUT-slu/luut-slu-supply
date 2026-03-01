import { useNavigate } from "react-router-dom";
import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Tag, Megaphone } from "lucide-react";

export default function MarketingControl() {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Discounts Manager",
      description: "Create, edit, and toggle discount codes synced with Shopify",
      icon: Tag,
      href: "/admin/marketing/discounts",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Popups Manager",
      description: "Manage promotional popups, scheduling, and targeting",
      icon: Megaphone,
      href: "/admin/marketing/popups",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
  ];

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-8 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl md:text-2xl">Marketing Control</h1>
              <p className="text-xs text-muted-foreground">Manage discounts & popups</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            {modules.map((m) => (
              <Card
                key={m.href}
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                onClick={() => navigate(m.href)}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${m.bgColor}`}>
                    <m.icon className={`h-6 w-6 ${m.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{m.title}</CardTitle>
                    <CardDescription className="mt-1">{m.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm">Open →</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </AdminAuth>
  );
}
