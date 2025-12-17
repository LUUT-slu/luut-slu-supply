import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { CheckCircle, DollarSign, Users, TrendingUp } from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Access Local Customers",
    description: "Reach buyers across Saint Lucia through our platform",
  },
  {
    icon: DollarSign,
    title: "Low Commission",
    description: "Only 10% commission - keep more of your earnings",
  },
  {
    icon: TrendingUp,
    title: "Grow Your Brand",
    description: "Build your reputation with verified seller status",
  },
];

const requirements = [
  "Must be based in Saint Lucia",
  "Valid ID for verification",
  "Ability to meet customers in Castries, Gros Islet, or Rodney Bay",
  "WhatsApp for customer communication",
  "Quality products only - no counterfeits",
];

export default function SellOnLuut() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-card to-background px-4 py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="mb-6 font-display text-4xl md:text-6xl">
                SELL ON <span className="text-primary">LUUT</span>
              </h1>
              <p className="mb-8 font-body text-lg text-muted-foreground">
                Join Saint Lucia's streetwear marketplace. List your products,
                connect with customers on WhatsApp, and handle meetups yourself.
              </p>
              <WhatsAppButton
                message="Hi! I'm interested in becoming a vendor on Luut SLU."
                size="lg"
              >
                Apply to Sell
              </WhatsAppButton>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center font-display text-2xl md:text-3xl">
              WHY SELL WITH US
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {benefits.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-card p-6 text-center"
                >
                  <Icon className="mx-auto mb-4 h-10 w-10 text-primary" />
                  <h3 className="mb-2 font-display text-lg">{title}</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center font-display text-2xl md:text-3xl">
              HOW IT WORKS
            </h2>
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-primary-foreground">
                  1
                </div>
                <div>
                  <h3 className="font-display text-lg">Apply via WhatsApp</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    Message us with your details and products
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-primary-foreground">
                  2
                </div>
                <div>
                  <h3 className="font-display text-lg">Get Verified</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    We verify your ID and products for quality
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-primary-foreground">
                  3
                </div>
                <div>
                  <h3 className="font-display text-lg">List & Sell</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    Your products go live. Customers find you through Luut.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-primary-foreground">
                  4
                </div>
                <div>
                  <h3 className="font-display text-lg">Meet & Collect</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    Handle meetups yourself. Pay Luut 10% commission.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="py-12 md:py-16">
          <div className="container">
            <h2 className="mb-10 text-center font-display text-2xl md:text-3xl">
              REQUIREMENTS
            </h2>
            <div className="mx-auto max-w-xl">
              <div className="rounded-lg border border-border bg-card p-6">
                <ul className="space-y-3">
                  {requirements.map((req) => (
                    <li key={req} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-trust" />
                      <span className="font-body text-sm">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-card py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="mb-4 font-display text-2xl md:text-3xl">
                READY TO START?
              </h2>
              <p className="mb-6 font-body text-muted-foreground">
                Message us on WhatsApp to begin the vendor application process
              </p>
              <WhatsAppButton
                message="Hi! I want to become a vendor on Luut SLU. Here are my details:"
                size="lg"
              >
                Apply Now
              </WhatsAppButton>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
