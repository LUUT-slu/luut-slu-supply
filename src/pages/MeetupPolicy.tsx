import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MapPin, Clock, Shield } from "lucide-react";

export default function MeetupPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <h1 className="font-display text-3xl md:text-5xl">
              MEET-UP & DELIVERY POLICY
            </h1>
            <p className="mt-4 font-body text-muted-foreground">
              How purchases work on Luut SLU
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-3xl">
            <div className="prose prose-invert max-w-none space-y-8">
              {/* Payment */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">PAYMENT METHOD</h2>
                <p className="font-body text-muted-foreground">
                  All purchases are <strong>pay on meetup (cash)</strong>. This
                  is the standard payment method on Luut SLU. We do not process
                  online payments - you pay the vendor directly when you meet.
                </p>
              </div>

              {/* Locations */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">MEET-UP LOCATIONS</h2>
                </div>
                <p className="mb-4 font-body text-muted-foreground">
                  Vendors arrange meetups in these safe, public areas:
                </p>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>
                    <strong>Castries</strong> - Capital city, central and
                    accessible
                  </li>
                  <li>
                    <strong>Gros Islet</strong> - Northern area, popular for
                    Friday night street party
                  </li>
                  <li>
                    <strong>Rodney Bay</strong> - Tourist area with shopping
                    centers
                  </li>
                </ul>
                <p className="mt-4 font-body text-sm text-muted-foreground">
                  When ordering, specify your preferred meetup location in the
                  order notes or via WhatsApp.
                </p>
              </div>

              {/* Scheduling */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">SCHEDULING</h2>
                </div>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>Contact the vendor via WhatsApp to arrange a time</li>
                  <li>Provide your preferred day and time window</li>
                  <li>Vendor will confirm availability</li>
                  <li>Arrive on time - vendors may leave after 15 minutes</li>
                </ul>
              </div>

              {/* Safety */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">SAFETY GUIDELINES</h2>
                </div>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>Always meet in public, well-lit areas</li>
                  <li>Bring exact cash when possible</li>
                  <li>Inspect items before paying</li>
                  <li>Keep communication through WhatsApp for records</li>
                  <li>Report any issues to Luut SLU immediately</li>
                </ul>
              </div>

              {/* Delivery */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">DELIVERY OPTIONS</h2>
                <p className="font-body text-muted-foreground">
                  Some vendors may offer delivery for an additional fee. This is
                  arranged directly with the vendor via WhatsApp. Luut SLU does
                  not handle deliveries - vendors manage their own fulfillment.
                </p>
              </div>

              {/* Questions */}
              <div className="text-center">
                <p className="mb-4 font-body text-muted-foreground">
                  Have questions about meetups?
                </p>
                <WhatsAppButton message="Hi! I have a question about the meetup process." />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
