import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { ChatButton } from "@/components/ChatButton";
import { AlertCircle, CreditCard, Clock } from "lucide-react";

export default function DepositPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Deposit & Pre-Order Policy — Luut SLU" description="How deposits and pre-orders work on Luut SLU, including refund and cancellation rules." path="/deposit-policy" />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">
              DEPOSIT & PRE-ORDER POLICY
            </h1>
            <p className="mt-4 font-body text-muted-foreground">
              Understanding deposits and pre-orders on Luut SLU
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-3xl">
            <div className="space-y-8">
              {/* When deposits apply */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">WHEN DEPOSITS APPLY</h2>
                </div>
                <p className="mb-4 font-body text-muted-foreground">
                  Deposits are only required for:
                </p>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>
                    <strong>Pre-orders</strong> - Items not yet in stock that
                    the vendor will order for you
                  </li>
                  <li>
                    <strong>Item holds/reservations</strong> - When you want a
                    specific item held for pickup
                  </li>
                </ul>
                <p className="mt-4 font-body text-sm text-muted-foreground">
                  Regular in-stock items are pay on meetup (cash) - no deposit
                  needed.
                </p>
              </div>

              {/* Deposit amount */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">DEPOSIT AMOUNTS</h2>
                <p className="font-body text-muted-foreground">
                  Deposit requirements vary by vendor and item. Typically:
                </p>
                <ul className="mt-4 space-y-2 font-body text-muted-foreground">
                  <li>Pre-orders: 50% deposit, balance on pickup</li>
                  <li>Item holds: 20-30% deposit, balance on pickup</li>
                </ul>
                <p className="mt-4 font-body text-sm text-muted-foreground">
                  Exact deposit amounts are shown on product pages and confirmed
                  via WhatsApp.
                </p>
              </div>

              {/* Non-refundable warning */}
              <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
                <div className="mb-4 flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <h2 className="font-display text-xl">IMPORTANT: NON-REFUNDABLE</h2>
                </div>
                <p className="font-body font-medium text-foreground">
                  Deposits are NON-REFUNDABLE if you:
                </p>
                <ul className="mt-4 space-y-2 font-body text-muted-foreground">
                  <li>Fail to show up for the meetup (no-show)</li>
                  <li>Change your mind after placing the order</li>
                  <li>Don't respond to vendor messages</li>
                </ul>
                <p className="mt-4 font-body text-sm text-foreground">
                  Make sure you're committed before placing a deposit.
                </p>
              </div>

              {/* Pre-order timeline */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">PRE-ORDER TIMELINE</h2>
                </div>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>
                    <strong>Step 1:</strong> Pay deposit via the method arranged
                    with vendor
                  </li>
                  <li>
                    <strong>Step 2:</strong> Vendor orders/sources the item
                  </li>
                  <li>
                    <strong>Step 3:</strong> Vendor notifies you when item
                    arrives (estimated time shown on product page)
                  </li>
                  <li>
                    <strong>Step 4:</strong> Arrange meetup and pay remaining
                    balance
                  </li>
                </ul>
              </div>

              {/* How to pay deposits */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">HOW TO PAY DEPOSITS</h2>
                <p className="font-body text-muted-foreground">
                  Deposit payments are arranged directly with the vendor via
                  WhatsApp. Common methods include:
                </p>
                <ul className="mt-4 space-y-2 font-body text-muted-foreground">
                  <li>Bank transfer</li>
                  <li>Mobile payment apps</li>
                  <li>In-person cash deposit</li>
                </ul>
                <p className="mt-4 font-body text-sm text-muted-foreground">
                  Always get confirmation from the vendor before sending any
                  payment.
                </p>
              </div>

              {/* Questions */}
              <div className="text-center">
                <p className="mb-4 font-body text-muted-foreground">
                  Questions about deposits or pre-orders?
                </p>
                <ChatButton>Ask About Deposits</ChatButton>
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
