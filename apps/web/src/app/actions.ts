"use server";

import { redirect } from "next/navigation";
import { prisma } from "@store/db";
import { createOrder, availableStockFor, InsufficientStockError, EmptyCartError } from "@store/db/orders";
import { imagesForVariants } from "@/lib/catalog";
import type { CartLine } from "@/lib/cart";

export interface ResolvedLine {
  variantId: string;
  productSlug: string;
  productName: string;
  label: string;
  image: { url: string; alt: string } | null;
  /** Serialized for the client boundary. */
  unitPriceKobo: string;
  quantity: number;
  available: number;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  totalKobo: string;
  /** Variant ids in the cart that no longer exist or are inactive. */
  dropped: string[];
}

/**
 * Turn stored variant ids into displayable lines, pricing every one from the
 * database. This is a preview only — checkout re-reads and re-totals inside
 * its transaction, so a stale price shown here can never become a charged one.
 */
export async function resolveCart(lines: CartLine[]): Promise<ResolvedCart> {
  const ids = lines.map((l) => l.variantId);
  if (ids.length === 0) return { lines: [], totalKobo: "0", dropped: [] };

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids }, active: true, product: { active: true } },
    include: { product: true },
  });
  const available = await availableStockFor(prisma, variants.map((v) => v.id));
  // Variant-bound where one exists: a line for a purple cap must not show the
  // black one.
  const images = await imagesForVariants(variants.map((v) => v.id));
  const byId = new Map(variants.map((v) => [v.id, v]));

  const resolved: ResolvedLine[] = [];
  const dropped: string[] = [];
  let totalKobo = 0n;

  for (const line of lines) {
    const variant = byId.get(line.variantId);
    if (!variant) {
      dropped.push(line.variantId);
      continue;
    }
    totalKobo += variant.priceKobo * BigInt(line.quantity);
    resolved.push({
      variantId: variant.id,
      productSlug: variant.product.slug,
      productName: variant.product.name,
      label: variant.label,
      image: images.get(variant.id) ?? null,
      unitPriceKobo: variant.priceKobo.toString(),
      quantity: line.quantity,
      available: available.get(variant.id) ?? 0,
    });
  }

  return { lines: resolved, totalKobo: totalKobo.toString(), dropped };
}

export interface CheckoutState {
  error?: string;
}

/**
 * Create the order and send the buyer to their payment instructions.
 *
 * The form contributes buyer details and a cart of ids/quantities. It does not
 * contribute prices, totals, or the reference code — all three are produced
 * server-side, which is what makes a tampered client harmless.
 */
export async function checkoutAction(
  lines: CartLine[],
  buyer: { name: string; phone: string; address: string },
): Promise<CheckoutState> {
  const name = buyer.name.trim();
  const phone = normalizePhone(buyer.phone);

  if (name.length < 2) return { error: "Please enter your full name." };
  if (!phone) {
    return { error: "Enter a valid Nigerian phone number, e.g. 08012345678." };
  }
  if (buyer.address.trim().length < 8) {
    return { error: "Please enter a delivery address we can actually find." };
  }

  let referenceCode: string;
  try {
    const order = await createOrder(prisma, {
      items: lines,
      buyerName: name,
      buyerPhone: phone,
      deliveryAddress: buyer.address,
    });
    referenceCode = order.referenceCode;
  } catch (error) {
    if (error instanceof InsufficientStockError) return { error: error.message };
    if (error instanceof EmptyCartError) return { error: "Your cart is empty." };
    console.error("checkout failed:", error);
    return { error: "Something went wrong creating your order. Please try again." };
  }

  // Outside the try: redirect() signals by throwing, and catching it here
  // would turn a successful checkout into an error message.
  redirect(`/orders/${referenceCode}`);
}

/**
 * Nigerian mobile numbers to E.164. Accepts 080..., 23480..., +23480...
 * Returns null when it cannot be sure — a wrong number means the buyer never
 * gets their confirmation, and guessing is worse than asking again.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+234${digits}`;
  return null;
}
