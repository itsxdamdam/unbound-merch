import type { Metadata } from "next";
import Link from "next/link";
import { CartProvider } from "@/lib/cart";
import { CartPill } from "@/components/CartPill";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unbound Merch",
  description: "Order by bank transfer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Behind everything, fixed. See .backdrop in globals.css. */}
        <div className="backdrop" aria-hidden="true" />
        <CartProvider>
          <header className="site-header">
            <div className="wrap">
              <Link className="brand" href="/" aria-label="Unbound — Godacity, home">
                {/* The logo is recoloured, not overlaid: the PNG is used as a
                    CSS mask and the brand purple shows through its alpha. An
                    overlay on top of the artwork would tint the transparent
                    background too. See .brand-logo in globals.css. */}
                <span className="brand-logo" role="img" aria-label="Unbound · Godacity" />
              </Link>
              {/* Cart only. Categories are reachable from the chips on the
                  shop pages, and /admin is deliberately unlinked — it is not a
                  customer destination, and it has no authentication yet. */}
              <nav className="nav">
                <CartPill />
              </nav>
            </div>
          </header>
          <main className="wrap page">{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
