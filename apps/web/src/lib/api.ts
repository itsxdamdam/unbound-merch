import type {
  CreateOrderRequest,
  CreateOrderResponse,
  Order,
  Product,
} from "./types";

/**
 * The backend contract.
 *
 * Every endpoint this storefront needs is declared here and nowhere else, so
 * the surface the backend has to implement is one file long:
 *
 *   GET  /products                     -> Product[]
 *   GET  /products/:slug               -> Product            (404 if unknown)
 *   POST /orders                       -> CreateOrderResponse
 *   GET  /orders/:reference            -> Order              (404 if unknown)
 *   POST /orders/:reference/pay        -> { authorizationUrl }
 *
 * Deliberately absent: anything that prices a cart. The frontend totals lines
 * for display only, from prices the backend gave it, and `POST /orders` sends
 * variant ids and quantities. The backend re-reads every price and computes the
 * total itself — so a tampered browser can order the wrong item, never at the
 * wrong price.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export function isApiConfigured(): boolean {
  return BASE.length > 0;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new ApiError(0, "NEXT_PUBLIC_API_URL is not set; no backend to call.");
  }

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    // Stock and order status change constantly; a cached catalogue would
    // advertise items that are already gone.
    cache: "no-store",
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Non-JSON error body; the status text will have to do.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export function listProducts(category?: string): Promise<Product[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return request<Product[]>(`/products${query}`);
}

/** Null for 404 — an unknown slug is a not-found page, not an error page. */
export async function getProduct(slug: string): Promise<Product | null> {
  try {
    return await request<Product>(`/products/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getOrder(reference: string): Promise<Order | null> {
  try {
    return await request<Order>(`/orders/${encodeURIComponent(reference)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function createOrder(body: CreateOrderRequest): Promise<CreateOrderResponse> {
  return request<CreateOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Restart payment for an order the buyer abandoned. */
export function startPayment(reference: string): Promise<{ authorizationUrl: string }> {
  return request<{ authorizationUrl: string }>(
    `/orders/${encodeURIComponent(reference)}/pay`,
    { method: "POST" },
  );
}
