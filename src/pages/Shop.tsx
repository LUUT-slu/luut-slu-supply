import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ArrowRight } from "lucide-react";

// Fit Builder categories in exact order - DO NOT CHANGE
const fitCategories = [
  { 
    name: "Beanies", 
    path: "/shop/beanies",
    emoji: "🧢",
    description: "Top off your fit"
  },
  { 
    name: "Hats", 
    path: "/shop/hats",
    emoji: "🎩",
    description: "Cap it right"
  },
  { 
    name: "Ski Masks / Facewear", 
    path: "/shop/facewear",
    emoji: "🎭",
    description: "Cover up in style"
  },
  { 
    name: "Shirts", 
    path: "/shop/shirts",
    emoji: "👕",
    description: "Layer one"
  },
  { 
    name: "Jackets", 
    path: "/shop/jackets",
    emoji: "🧥",
    description: "Outer layer"
  },
  { 
    name: "Hoodies", 
    path: "/shop/hoodies",
    emoji: "🪝",
    description: "Stay cozy"
  },
  { 
    name: "Pants", 
    path: "/shop/pants",
    emoji: "👖",
    description: "Bottom half"
  },
  { 
    name: "Shorts", 
    path: "/shop/shorts",
    emoji: "🩳",
    description: "Keep it cool"
  },
  { 
    name: "Boxers", 
    path: "/shop/boxers",
    emoji: "🩲",
    description: "Underneath"
  },
  { 
    name: "Bags", 
    path: "/shop/bags",
    emoji: "🎒",
    description: "Carry your essentials"
  },
  { 
    name: "Shoes", 
    path: "/shop/shoes",
    emoji: "👟",
    description: "Step out fresh"
  },
  { 
    name: "Slippers", 
    path: "/shop/slippers",
    emoji: "🥿",
    description: "Slide into comfort"
  },
  { 
    name: "Sandals", 
    path: "/shop/sandals",
    emoji: "🩴",
    description: "Island vibes"
  },
  { 
    name: "Socks", 
    path: "/shop/socks",
    emoji: "🧦",
    description: "Complete the fit"
  },
];

export default function Shop() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-card to-background px-4 py-12 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="mb-4 font-display text-4xl tracking-wider md:text-6xl lg:text-7xl">
                BUILD YOUR <span className="text-primary">FIT</span>
              </h1>
              <p className="font-body text-lg text-muted-foreground md:text-xl">
                Scroll down to build your outfit from head to toe. <br className="hidden md:block" />
                Click any category to explore products.
              </p>
            </div>
          </div>
        </section>

        {/* Fit Builder - Vertical scroll */}
        <section className="py-8 md:py-12">
          <div className="container max-w-3xl">
            <div className="space-y-6 md:space-y-8">
              {fitCategories.map((category, index) => (
                <Link
                  key={category.path}
                  to={category.path}
                  className="group relative block overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex items-center justify-between p-6 md:p-8">
                    {/* Left side - Number & Name */}
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-lg text-primary/50 md:h-14 md:w-14 md:text-xl">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <h2 className="font-display text-xl tracking-wide md:text-2xl lg:text-3xl">
                          {category.name.toUpperCase()}
                        </h2>
                        <p className="mt-1 font-body text-sm text-muted-foreground md:text-base">
                          {category.description}
                        </p>
                      </div>
                    </div>

                    {/* Right side - Emoji & Arrow */}
                    <div className="flex items-center gap-4">
                      <span className="text-4xl md:text-5xl lg:text-6xl opacity-80 transition-transform duration-300 group-hover:scale-110">
                        {category.emoji}
                      </span>
                      <ArrowRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary md:h-6 md:w-6" />
                    </div>
                  </div>

                  {/* Hover gradient line */}
                  <div className="absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-gradient-to-r from-primary to-primary/50 transition-transform duration-300 group-hover:scale-x-100" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border bg-card py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="mb-4 font-display text-2xl md:text-3xl">
                NEED HELP BUILDING YOUR FIT?
              </h2>
              <p className="mb-6 font-body text-muted-foreground">
                Message us on WhatsApp and we'll help you put together the perfect outfit
              </p>
              <WhatsAppButton 
                size="lg" 
                message="Hi! I need help building a fit. Can you recommend some pieces?"
              >
                Get Fit Advice
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
