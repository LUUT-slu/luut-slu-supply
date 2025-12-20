import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { WhatsAppButton } from "@/components/WhatsAppButton";

// Fit categories in exact order - DO NOT CHANGE
const fitCategories = [
  { 
    name: "Beanies", 
    path: "/shop/beanies",
    image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=600&h=600&fit=crop"
  },
  { 
    name: "Hats", 
    path: "/shop/hats",
    image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&h=600&fit=crop"
  },
  { 
    name: "Ski Masks / Facewear", 
    path: "/shop/facewear",
    image: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5a?w=600&h=600&fit=crop"
  },
  { 
    name: "Shirts", 
    path: "/shop/shirts",
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=600&fit=crop"
  },
  { 
    name: "Jackets", 
    path: "/shop/jackets",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=600&fit=crop"
  },
  { 
    name: "Hoodies", 
    path: "/shop/hoodies",
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop"
  },
  { 
    name: "Pants", 
    path: "/shop/pants",
    image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&h=600&fit=crop"
  },
  { 
    name: "Shorts", 
    path: "/shop/shorts",
    image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&h=600&fit=crop"
  },
  { 
    name: "Boxers", 
    path: "/shop/boxers",
    image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&h=600&fit=crop"
  },
  { 
    name: "Bags", 
    path: "/shop/bags",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop"
  },
  { 
    name: "Shoes", 
    path: "/shop/shoes",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop"
  },
  { 
    name: "Slippers", 
    path: "/shop/slippers",
    image: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600&h=600&fit=crop"
  },
  { 
    name: "Sandals", 
    path: "/shop/sandals",
    image: "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600&h=600&fit=crop&sat=-100"
  },
  { 
    name: "Socks", 
    path: "/shop/socks",
    image: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=600&h=600&fit=crop"
  },
];

export default function Shop() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-card px-4 py-10 md:py-14">
          <div className="container">
            <BackButton />
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="font-display text-4xl tracking-wider md:text-5xl lg:text-6xl">
                CREATE A <span className="text-primary">FIT</span>
              </h1>
              <p className="mt-3 font-body text-muted-foreground md:text-lg">
                Pick your pieces. Build your look.
              </p>
            </div>
          </div>
        </section>

        {/* Visual Grid Gallery */}
        <section className="px-4 py-8 md:py-12">
          <div className="container">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
              {fitCategories.map((category, index) => (
                <Link
                  key={category.path}
                  to={category.path}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-border/50 transition-all duration-300 hover:ring-2 hover:ring-primary/50 hover:shadow-lg hover:shadow-primary/10 animate-fade-in opacity-0"
                  style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
                >
                  {/* Image with zoom effect */}
                  <img
                    src={category.image}
                    alt={category.name}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                  
                  {/* Gradient overlay - intensifies on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 group-hover:from-black/70" />
                  
                  {/* Category label with animation */}
                  <div className="absolute bottom-3 left-3 right-3 transition-transform duration-300 ease-out group-hover:translate-y-[-4px]">
                    <span className="inline-block rounded-full bg-background/90 px-3 py-1.5 font-display text-xs tracking-wide text-foreground backdrop-blur-sm transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground md:text-sm">
                      {category.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}