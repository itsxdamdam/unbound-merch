/**
 * The shapes the backend returns.
 *
 * Money crosses the wire as a STRING of kobo, never a number. Prices are
 * integer minor units and JSON numbers are IEEE doubles — a float is the wrong
 * type for money, and a string keeps the exact value intact until it is either
 * formatted for display or handed back to the backend untouched. The frontend
 * never does arithmetic that decides what anyone is charged.
 */
export type Kobo = string;

export type CategorySlug = "tshirts" | "jerseys" | "scarves" | "caps" | "tote-bags";

export interface ProductImage {
  url: string;
  alt: string;
  /** Null for a product-level angle (a tee's front/back) shared by every variant. */
  variantId: string | null;
}

export interface ProductVariant {
  id: string;
  /** "M", "XL", "Black", "One Size". */
  label: string;
  priceKobo: Kobo;
  /** Available to sell right now, after holds. Computed by the backend. */
  available: number;
}

export interface Product {
  slug: string;
  name: string;
  description: string;
  category: CategorySlug;
  /** Lowest variant price, for the "from" figure on the grid. */
  fromKobo: Kobo;
  variants: ProductVariant[];
  images: ProductImage[];
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "expired"
  | "cancelled"
  | "manual_review";

export interface OrderItem {
  name: string;
  variantLabel: string;
  quantity: number;
  unitPriceKobo: Kobo;
}

export interface Order {
  referenceCode: string;
  status: OrderStatus;
  totalKobo: Kobo;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  items: OrderItem[];
  /** ISO 8601. When the stock hold lapses. */
  expiresAt: string;
  paidAt: string | null;
}

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CartLine[];
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
}

export interface CreateOrderResponse {
  referenceCode: string;
  /** Paystack's hosted checkout URL. The browser navigates to it. */
  authorizationUrl: string;
}
