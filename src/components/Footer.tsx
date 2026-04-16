import { Link } from "react-router-dom";
import { Instagram, Facebook } from "lucide-react";
import { ChatButton } from "./ChatButton";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-10 md:py-14">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <span className="font-display text-lg font-bold text-foreground">LUUT SLU</span>
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              Saint Lucia's streetwear marketplace. We connect buyers with verified local sellers who handle meetups & delivery.
            </p>
            <div className="flex gap-3">
              <a
                href="https://instagram.com/luutslu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://facebook.com/luutslu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Facebook className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-bold uppercase text-foreground">Shop</h4>
            <nav className="flex flex-col gap-1.5">
              <Link to="/shop" className="font-body text-xs text-muted-foreground hover:text-foreground">
                All Outfits
              </Link>
              <Link to="/shop?filter=new" className="font-body text-xs text-muted-foreground hover:text-foreground">
                New Arrivals
              </Link>
              <Link to="/shop?filter=best" className="font-body text-xs text-muted-foreground hover:text-foreground">
                Best Sellers
              </Link>
              <Link to="/sellers" className="font-body text-xs text-muted-foreground hover:text-foreground">
                Our Sellers
              </Link>
            </nav>
          </div>

          {/* Policies */}
          <div className="space-y-3">
            <h4 className="font-display text-sm font-bold uppercase text-foreground">Policies</h4>
            <nav className="flex flex-col gap-1.5">
              <Link to="/meetup-policy" className="font-body text-xs text-muted-foreground hover:text-foreground">
                Meet-Up & Delivery
              </Link>
              <Link to="/deposit-policy" className="font-body text-xs text-muted-foreground hover:text-foreground">
                Deposits & Pre-Orders
              </Link>
              <Link to="/refund-policy" className="font-body text-xs text-muted-foreground hover:text-foreground">
                Refunds & Returns
              </Link>
              <Link to="/sell" className="font-body text-xs text-muted-foreground hover:text-foreground">
                Sell on Luut
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="space-y-3 text-center md:text-left">
            <h4 className="font-display text-sm font-bold uppercase text-foreground">Contact</h4>
            <p className="font-body text-xs text-muted-foreground">
              Chat with us for quick support.
            </p>
            <div className="flex justify-center md:justify-start">
              <ChatButton size="sm" />
            </div>
            <p className="font-body text-[10px] text-muted-foreground">
              Based in Saint Lucia 🇱🇨
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="font-body text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} Luut SLU. All rights reserved.
          </p>
          <nav className="flex gap-4">
            <Link 
              to="/admin" 
              className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Seller Portal
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
