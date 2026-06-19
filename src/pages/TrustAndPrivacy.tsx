import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { ChatButton } from "@/components/ChatButton";
import { Shield, Lock, Database, Users, Cookie, MessageCircle, Mail } from "lucide-react";

export default function TrustAndPrivacy() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO
        title="Trust, Security & Privacy — Luut SLU"
        description="How Luut SLU handles your account, order, and contact information, and the controls available to buyers and sellers."
        path="/trust"
      />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">TRUST, SECURITY & PRIVACY</h1>
            <p className="mt-3 max-w-2xl font-body text-muted-foreground">
              This page is maintained by Luut SLU to answer common security and privacy questions
              about how the marketplace handles your information. It is editable project content,
              not an independent certification.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-3xl space-y-8">
            {/* Shared responsibility */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">SHARED RESPONSIBILITY</h2>
              </div>
              <p className="font-body text-muted-foreground">
                Luut SLU is a marketplace connector in Saint Lucia. The underlying hosting and
                backend platform provides infrastructure-level controls (TLS in transit, managed
                authentication, encrypted database storage). Luut SLU is responsible for how the
                app uses those controls — access rules, order data, and seller information.
                Sellers are responsible for fulfilling their own orders and for the messages they
                exchange with buyers over WhatsApp.
              </p>
            </div>

            {/* Authentication & access */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">ACCOUNTS & ACCESS</h2>
              </div>
              <ul className="space-y-2 font-body text-muted-foreground">
                <li>• Sign-in is handled by managed authentication (email/password and Google).</li>
                <li>• Roles — Admin, Partner, Seller, Customer — are stored server-side and enforced by database row-level security policies.</li>
                <li>• Sellers can only see their own products, orders, and profile. Customers can only see their own orders.</li>
                <li>• Seller contact details (phone, WhatsApp) are not browsable by other signed-in users; buyers reach sellers through pre-filled WhatsApp links generated per order.</li>
              </ul>
            </div>

            {/* Data we collect */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">WHAT WE COLLECT</h2>
              </div>
              <p className="mb-3 font-body text-muted-foreground">
                We only collect what we need to operate the marketplace:
              </p>
              <ul className="space-y-2 font-body text-muted-foreground">
                <li>• <strong>Account:</strong> name, email, and (for Google sign-in) profile photo.</li>
                <li>• <strong>Orders:</strong> name, WhatsApp number, optional email, meetup location, and order notes.</li>
                <li>• <strong>Sellers:</strong> business name, WhatsApp/Instagram, payout info, and uploaded identity documents (stored in a private bucket, not publicly listable).</li>
                <li>• <strong>Usage:</strong> basic analytics events used to improve the site.</li>
              </ul>
            </div>

            {/* Subprocessors */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">INTEGRATIONS WE RELY ON</h2>
              </div>
              <ul className="space-y-2 font-body text-muted-foreground">
                <li>• <strong>Hosting & backend platform</strong> — application hosting, database, authentication, file storage.</li>
                <li>• <strong>Shopify</strong> — catalog sync and draft order creation for the primary seller storefront.</li>
                <li>• <strong>Google</strong> — optional sign-in and calendar events for confirmed orders.</li>
                <li>• <strong>WhatsApp</strong> — buyer/seller order confirmation and coordination.</li>
                <li>• <strong>Meta Pixel</strong> — site analytics on public pages.</li>
              </ul>
            </div>

            {/* Cookies */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Cookie className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">COOKIES & ANALYTICS</h2>
              </div>
              <p className="font-body text-muted-foreground">
                We use first-party storage to keep you signed in and to remember your cart. We use
                Meta Pixel for aggregate analytics on public storefront pages. We do not sell your
                personal data.
              </p>
            </div>

            {/* Your rights */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">YOUR CHOICES</h2>
              </div>
              <ul className="space-y-2 font-body text-muted-foreground">
                <li>• <strong>Review & edit:</strong> sign in and visit Account Settings to update your details.</li>
                <li>• <strong>Order history:</strong> visit My Orders to see and cancel your active orders.</li>
                <li>• <strong>Deletion request:</strong> contact us using the address below and we will remove your account and associated personal data, subject to records we may be required to keep (e.g. completed orders for accounting).</li>
              </ul>
            </div>

            {/* Security contact */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl">SECURITY CONTACT</h2>
              </div>
              <p className="font-body text-muted-foreground">
                If you believe you have found a security or privacy issue, please reach out through
                our contact page or via WhatsApp. We will acknowledge reports and work to address
                valid issues promptly.
              </p>
            </div>

            {/* CTA */}
            <div className="text-center">
              <p className="mb-4 font-body text-muted-foreground">
                Still have questions about your data or account?
              </p>
              <ChatButton>Talk to Luut SLU</ChatButton>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ChatButton variant="floating" />
    </div>
  );
}
