import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { AdminGroupNav } from "@/components/admin/AdminGroupNav";
import { PopupsSection } from "@/components/admin/PopupsSection";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function AdminPopups() {
  const { data: settings } = useSiteSettings();
  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <AdminGroupNav group="marketing" />
        <main className="container flex-1 py-6">
          <PopupsSection initialPopups={settings?.popups || []} />
        </main>
      </div>
    </AdminAuth>
  );
}
