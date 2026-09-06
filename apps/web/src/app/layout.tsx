import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@store/db/categories";
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
              <Link className="brand" href="/">Unbound</Link>
              <nav className="nav">
                {CATEGORIES.map((c) => (
                  <Link key={c.slug} href={`/shop/${c.slug}`}>{c.label}</Link>
                ))}
                <Link href="/admin">Admin</Link>
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
