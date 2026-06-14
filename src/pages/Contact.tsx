import { Header } from "@/components/Header";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { ChatButton } from "@/components/ChatButton";
import { MapPin, MessageCircle, Instagram, Facebook } from "lucide-react";

export default function Contact() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Contact Luut SLU — Saint Lucia Streetwear Support" description="Reach the Luut SLU team for help with orders, seller applications, or platform questions." path="/contact" />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-card px-4 py-12">
          <div className="container">
            <BackButton />
            <h1 className="font-display text-3xl md:text-5xl">CONTACT US</h1>
            <p className="mt-4 font-body text-muted-foreground">
              Get in touch with Luut SLU
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container max-w-3xl">
            <div className="space-y-8">
              {/* Chat - Primary */}
              <div className="rounded-lg border-2 border-primary bg-card p-8 text-center">
                <MessageCircle className="mx-auto mb-4 h-12 w-12 text-primary" />
                <h2 className="mb-2 font-display text-2xl">
                  CHAT WITH US
                </h2>
                <p className="mb-6 font-body text-muted-foreground">
                  For the fastest response, start a chat with us. We typically
                  reply within a few hours.
                </p>
                <ChatButton size="lg">
                  Start a Chat
                </ChatButton>
              </div>

              {/* Social Media */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">FOLLOW US</h2>
                <p className="mb-4 font-body text-muted-foreground">
                  Stay updated on new drops and vendor highlights
                </p>
                <div className="flex gap-4">
                  <a
                    href="https://instagram.com/luutslu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary"
                  >
                    <Instagram className="h-5 w-5" />
                    <span className="font-body text-sm">Instagram</span>
                  </a>
                  <a
                    href="https://facebook.com/luutslu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary"
                  >
                    <Facebook className="h-5 w-5" />
                    <span className="font-body text-sm">Facebook</span>
                  </a>
                </div>
              </div>

              {/* Location */}
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl">BASED IN SAINT LUCIA</h2>
                </div>
                <p className="font-body text-muted-foreground">
                  Luut SLU is a Saint Lucian marketplace serving the local
                  community. We facilitate meetups in Castries, Gros Islet, and
                  Rodney Bay.
                </p>
              </div>

              {/* Response times */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 font-display text-xl">RESPONSE TIMES</h2>
                <ul className="space-y-2 font-body text-muted-foreground">
                  <li>
                    <strong>Chat:</strong> Usually within a few hours
                  </li>
                  <li>
                    <strong>Instagram/Facebook:</strong> 1-2 business days
                  </li>
                </ul>
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
