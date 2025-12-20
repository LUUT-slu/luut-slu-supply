import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export default function SellOnLuut() {
  const applyMessage = `Hi Luut SLU 👋
I'm interested in selling on the platform.

Brand / Page Name:
Instagram Link:
WhatsApp Business Number:
Meetup Location(s):
Do you offer delivery? (Yes/No):

Looking forward to getting started.`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="px-4 py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-2xl">
              <BackButton />
              {/* WHERE BRANDS GROW */}
              <div className="mb-16 text-center">
                <h1 className="mb-8 font-display text-4xl md:text-5xl">
                  WHERE BRANDS <span className="text-primary">GROW</span>
                </h1>

                <div className="space-y-4 font-body text-muted-foreground">
                  <p className="text-lg">
                    This space is built for local creators, resellers, and brand builders who want to grow.
                  </p>
                  <p>
                    You keep your own identity, your own pages, and your own way of selling.
                    The platform exists to make growth simpler — helping customers discover your products and connect with you faster, especially through WhatsApp.
                  </p>
                </div>
              </div>

              {/* HOW IT WORKS */}
              <div className="mb-16">
                <h2 className="mb-6 text-center font-display text-2xl md:text-3xl">
                  HOW IT WORKS
                </h2>

                <div className="rounded-lg border border-border bg-card p-6">
                  <ul className="space-y-4 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">1</span>
                      <span className="font-body text-muted-foreground">Your products are listed on the platform</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">2</span>
                      <span className="font-body text-muted-foreground">Platform ads drive traffic directly to your product page</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">3</span>
                      <span className="font-body text-muted-foreground">Customers click and message you on WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">4</span>
                      <span className="font-body text-muted-foreground">You handle the conversation, meetup, and sale</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 space-y-3 text-center font-body text-sm text-muted-foreground">
                  <p>
                    You're still free to promote your products on your own pages — share your link, repost your listings, or run ads to your page on the platform.
                  </p>
                  <p>
                    A small platform commission supports ads, visibility, and operations. Full details are shared during onboarding.
                  </p>
                </div>
              </div>

              {/* REQUIREMENTS */}
              <div className="mb-16">
                <h2 className="mb-6 text-center font-display text-2xl md:text-3xl">
                  REQUIREMENTS
                </h2>

                <div className="rounded-lg border border-border bg-card p-6">
                  <ul className="space-y-3 font-body text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Based in Saint Lucia</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Able to meet customers (Castries, Gros Islet, Rodney Bay, or your own set location)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Active Instagram page</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>WhatsApp Business account (business only — no personal WhatsApp)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Clear product photos customers can easily understand</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Facebook page (optional)</span>
                    </li>
                  </ul>

                  <p className="mt-6 border-t border-border pt-4 font-body text-xs text-muted-foreground">
                    If you offer delivery, clearly state your delivery areas and cost.
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <WhatsAppButton
                  message={applyMessage}
                  size="lg"
                >
                  Apply to Sell
                </WhatsAppButton>
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
