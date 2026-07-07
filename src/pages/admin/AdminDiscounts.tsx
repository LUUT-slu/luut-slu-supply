import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { AdminGroupNav } from "@/components/admin/AdminGroupNav";
import { DiscountsSection } from "@/components/admin/DiscountsSection";

export default function AdminDiscounts() {
  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <AdminGroupNav group="marketing" />
        <main className="container flex-1 py-6">
          <DiscountsSection />
        </main>
      </div>
    </AdminAuth>
  );
}
