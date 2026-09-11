import type { Metadata } from "next";
import Link from "next/link";
import { CartProvider } from "@/lib/cart";
import { CartPill } from "@/components/CartPill";
import { ThemeToggle } from "@/components/ThemeToggle";
import { STORE_OPEN } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unbound Merch",
  description: "Godacity merch. Pay with Paystack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies a stored theme before first paint, so dark mode does not
            flash white on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("unbound-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* Behind everything, fixed. See .backdrop in globals.css. */}
        <div className="backdrop" aria-hidden="true" />
        <CartProvider>
          <header className="site-header">
            <div className="wrap">
              <Link className="brand" href="/" aria-label="Unbound — Godacity, home">
                  <span className="brand-logo" role="img" aria-label="Unbound · Godacity" />
              </Link>
              {/* Categories live in the chips on the shop pages. */}
              <nav className="nav">
                <ThemeToggle />
                {STORE_OPEN && <CartPill />}
              </nav>
            </div>
          </header>
          <main className="wrap page">{children}</main>
        </CartProvider>
      </body>
    </html>
  );
}
