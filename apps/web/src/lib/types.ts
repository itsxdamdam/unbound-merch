/**
 * Whole naira, as an integer — the same unit the payment API takes.
 *
 * Integers stay exact in JS; the moment a price gains kobo it becomes a float
 * and stops adding up exactly. Sub-naira pricing would mean switching both
 * sides to kobo.
 */
export type Naira = number;

export type CategorySlug = "tshirts" | "jerseys" | "scarves" | "caps" | "tote-bags";

export interface ProductImage {
  url: string;
  alt: string;
  /** Null for a product-level angle (a tee's front/back) shared by every variant. */
  variantId: string | null;
}

export interface ProductVariant {
  /**
   * Stable across deploys. The cart stores these in the browser and the
   * payment API receives them, so renaming one empties returning customers'
   * carts and orphans anything in flight.
   */
  id: string;
  /** "M", "XL", "Black", "One Size". */
  label: string;
  /** Whole naira. */
  price: Naira;
}

/**
 * No stock field, deliberately.
 *
 * The catalogue is hard-coded and the backend handles payment only, so nothing
 * in this system can know how many of something is left. Rendering a count
 * would be inventing one. If stock tracking arrives later it belongs on
 * whatever owns it, and this type grows a field then.
 */
export interface Product {
  slug: string;
  name: string;
  description: string;
  category: CategorySlug;
  /** Lowest variant price, for the "from" figure on the grid. Whole naira. */
  fromPrice: Naira;
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface CartLine {
  variantId: string;
  quantity: number;
}

/** `size` is the variant label whatever the axis — "M", "Purple", "One Size". */
export interface PaymentItem {
  name: string;
  size: string;
  quantity: number;
  /** Whole naira. */
  unitPrice: Naira;
}

/**
 * SECURITY: `amount` and `unitPrice` are computed in the browser and can be
 * edited before they are sent — someone can pay ₦100 for a ₦17,000 jersey.
 * Prices are hard-coded here, so the backend has no copy to check against.
 * Fix belongs there: a name+size -> price map, recompute, reject mismatches.
 */
export interface PaymentInitializeRequest {
  /** Whole naira. Sum of the lines. */
  amount: Naira;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Where Paystack returns the buyer. Paystack appends ?reference & ?trxref. */
  callbackUrl: string;
  items: PaymentItem[];
}

export interface PaymentInitializeResponse {
  authorizationUrl: string;
  reference: string;
}

/** Flattened from the verify response's `payment` object. */
export interface PaymentVerification {
  reference: string;
  /** True only when the backend reports a settled, successful charge. */
  paid: boolean;
  /** Verbatim status from the backend, for display and support. */
  status: string;
  /** Whole naira, when reported. */
  amount: Naira | null;
  currency: string | null;
  /** ISO 8601, when the charge settled. */
  paidAt: string | null;
  /** "card", "bank", "ussd" … */
  channel: string | null;
  customerName: string | null;
  /** Echoed back from initialize. */
  items: PaymentItem[];
}
