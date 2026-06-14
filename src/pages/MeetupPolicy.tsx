import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { ChatButton } from "@/components/ChatButton";
import { MapPin, MessageCircle } from "lucide-react";

export default function MeetupPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Meet-Up Policy — Luut SLU" description="Approved Saint Lucia meet-up locations and safety guidance for buyers and sellers on Luut SLU." path="/meetup-policy" />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">
              MEET-UP POLICY
            </h1>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-3xl">
            <div className="space-y-8">
              {/* Locations */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">MEET-UP LOCATIONS</h2>
                </div>
                <p className="mb-4 font-body text-muted-foreground">
                  Meetups usually happen in public, active areas.<br />
                  Exact spots are confirmed after ordering.
                </p>
                <p className="mb-3 font-body font-medium text-foreground">
                  Common areas include:
                </p>
                <ul className="mb-6 space-y-1 font-body text-muted-foreground">
                  <li>• Castries</li>
                  <li>• Gros Islet</li>
                  <li>• Vieux Fort</li>
                </ul>
                <div className="flex items-start gap-2 rounded-md bg-primary/5 p-4">
                  <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                  <p className="font-body text-sm text-muted-foreground">
                    Customers and vendors confirm the exact meetup point via WhatsApp after the order is placed.
                  </p>
                </div>
              </div>

              {/* Coverage */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">ISLAND-WIDE COVERAGE</h2>
                <p className="mb-4 font-body text-muted-foreground">
                  Straight, familiar, island-wide coverage:
                </p>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li><strong>North</strong> → Gros Islet</li>
                  <li><strong>Central</strong> → Castries</li>
                  <li><strong>South</strong> → Vieux Fort</li>
                </ul>
                <p className="mt-6 font-body text-sm text-muted-foreground italic">
                  Nothing extra, nothing risky, nothing confusing.
                </p>
              </div>

              {/* Questions */}
              <div className="text-center">
                <p className="mb-4 font-body text-muted-foreground">
                  Have questions about meetups?
                </p>
                <ChatButton>Ask About Meetups</ChatButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
