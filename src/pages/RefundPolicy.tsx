import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { XCircle, AlertTriangle } from "lucide-react";

export default function RefundPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">
              REFUND & RETURN POLICY
            </h1>
            <p className="mt-4 font-body text-muted-foreground">
              Our simple, clear policy on returns
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-3xl">
            <div className="space-y-8">
              {/* Main policy */}
              <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
                <div className="mb-4 flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <h2 className="font-display text-xl">ALL SALES ARE FINAL</h2>
                </div>
                <p className="font-body text-foreground">
                  Luut SLU operates on a <strong>no refund, no return</strong>{" "}
                  policy. Once you've paid for an item at meetup, the sale is
                  complete.
                </p>
              </div>

              {/* Why */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">WHY THIS POLICY?</h2>
                <p className="font-body text-muted-foreground">
                  As a meetup-based marketplace, you have the opportunity to:
                </p>
                <ul className="mt-4 space-y-2 font-body text-muted-foreground">
                  <li>Inspect items in person before paying</li>
                  <li>Try on clothing/accessories at the meetup</li>
                  <li>Ask questions and verify authenticity</li>
                  <li>Walk away if you're not satisfied</li>
                </ul>
                <p className="mt-4 font-body text-sm text-muted-foreground">
                  This policy protects both buyers and sellers in our local
                  marketplace.
                </p>
              </div>

              {/* Exceptions */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">EXCEPTIONS</h2>
                </div>
                <p className="mb-4 font-body text-muted-foreground">
                  We may consider exceptions only for:
                </p>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>
                    <strong>Defective items</strong> - Manufacturing defects not
                    visible at meetup (report within 24 hours)
                  </li>
                  <li>
                    <strong>Wrong item received</strong> - If vendor gives you
                    the wrong product (report immediately)
                  </li>
                </ul>
                <p className="mt-4 font-body text-sm text-muted-foreground">
                  These cases are handled directly with the vendor via WhatsApp.
                  Luut SLU may mediate if needed.
                </p>
              </div>

              {/* Before you buy */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">BEFORE YOU BUY</h2>
                <p className="mb-4 font-body text-muted-foreground">
                  To avoid issues, we recommend:
                </p>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>Ask vendors for detailed photos/videos via WhatsApp</li>
                  <li>Confirm sizing and measurements before meetup</li>
                  <li>Inspect items thoroughly at the meetup</li>
                  <li>Don't pay until you're 100% satisfied</li>
                </ul>
              </div>

              {/* Deposits reminder */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">DEPOSITS</h2>
                <p className="font-body text-muted-foreground">
                  Remember: Deposits for pre-orders and holds are{" "}
                  <strong>non-refundable</strong> if you no-show or change your
                  mind. See our{" "}
                  <a
                    href="/deposit-policy"
                    className="text-primary hover:underline"
                  >
                    Deposit Policy
                  </a>{" "}
                  for details.
                </p>
              </div>

              {/* Contact */}
              <div className="text-center">
                <p className="mb-4 font-body text-muted-foreground">
                  Have an issue with an order?
                </p>
                <WhatsAppButton message="Hi! I have an issue with my order that I need help with." />
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
