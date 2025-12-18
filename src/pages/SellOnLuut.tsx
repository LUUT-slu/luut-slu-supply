import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export default function SellOnLuut() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="px-4 py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-2xl">
              <h1 className="mb-8 font-display text-4xl md:text-5xl">
                WHERE BRANDS <span className="text-primary">GROW</span>
              </h1>

              <div className="space-y-6 font-body text-muted-foreground">
                <p className="text-lg">
                  This space is built for local creators, resellers, and brand builders who want to grow.
                </p>

                <p>
                  You keep your own identity, your own pages, and your own way of selling.
                  The platform exists to make growth simpler — helping customers discover your products and connect with you faster, especially through WhatsApp.
                </p>

                <div className="rounded-lg border border-border bg-card p-6">
                  <h2 className="mb-4 font-display text-lg">HOW IT WORKS</h2>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">1</span>
                      <span>Your products are listed on the platform</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">2</span>
                      <span>Platform ads drive traffic directly to your product page</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">3</span>
                      <span>Customers click and message you on WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">4</span>
                      <span>You handle the conversation, meetup, and sale</span>
                    </li>
                  </ul>
                </div>

                <p>
                  You're still free to promote your products on your own — share your link, repost your product page, or run ads to your page on the platform.
                </p>

                <p className="text-sm">
                  A small platform commission supports visibility, ads, and operations. Full details are shared during onboarding.
                </p>
              </div>

              <div className="mt-10">
                <WhatsAppButton
                  message="Hi! I'm interested in selling on the platform."
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
