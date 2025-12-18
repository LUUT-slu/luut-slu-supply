import { Link } from "react-router-dom";
import { Instagram, Facebook } from "lucide-react";
import { WhatsAppButton } from "./WhatsAppButton";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <span className="font-display text-3xl text-primary">LUUT SLU</span>
            <p className="font-body text-sm text-muted-foreground">
              Saint Lucia's streetwear marketplace. We connect buyers with verified local sellers who handle meetups & delivery.
            </p>
            <div className="flex gap-4">
              <a
                href="https://instagram.com/luutslu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://facebook.com/luutslu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-4">
            <h4 className="font-display text-lg">SHOP</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/shop" className="font-body text-sm text-muted-foreground hover:text-foreground">
                All Outfits
              </Link>
              <Link to="/shop?filter=new" className="font-body text-sm text-muted-foreground hover:text-foreground">
                New Arrivals
              </Link>
              <Link to="/shop?filter=best" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Best Sellers
              </Link>
              <Link to="/sellers" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Our Sellers
              </Link>
            </nav>
          </div>

          {/* Policies */}
          <div className="space-y-4">
            <h4 className="font-display text-lg">POLICIES</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/meetup-policy" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Meet-Up & Delivery
              </Link>
              <Link to="/deposit-policy" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Deposits & Pre-Orders
              </Link>
              <Link to="/refund-policy" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Refunds & Returns
              </Link>
              <Link to="/sell" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Sell on Luut
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-4 text-center md:text-left">
            <h4 className="font-display text-lg">CONTACT</h4>
            <p className="font-body text-sm text-muted-foreground">
              WhatsApp is our main communication channel.
            </p>
            <div className="flex justify-center md:justify-start">
              <WhatsAppButton size="sm" />
            </div>
            <p className="font-body text-xs text-muted-foreground">
              Based in Saint Lucia 🇱🇨
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-center font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} Luut SLU. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
