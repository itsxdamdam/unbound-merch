/** Thrown when a requested variant is missing, inactive, or short on stock. */
export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";
  constructor(
    readonly variantId: string,
    readonly requested: number,
    readonly available: number,
    readonly label: string,
  ) {
    super(`Only ${available} left of ${label} (requested ${requested}).`);
    this.name = "InsufficientStockError";
  }
}

export class EmptyCartError extends Error {
  readonly code = "EMPTY_CART";
  constructor() {
    super("Cannot create an order with no items.");
    this.name = "EmptyCartError";
  }
}

/**
 * confirmPayment refused the transition. `reason` is surfaced to the admin
 * queue verbatim, so it is written to be read by a human under time pressure.
 */
export class PaymentConfirmationError extends Error {
  readonly code = "PAYMENT_NOT_CONFIRMABLE";
  constructor(
    readonly orderId: string,
    reason: string,
  ) {
    super(reason);
    this.name = "PaymentConfirmationError";
  }
}
