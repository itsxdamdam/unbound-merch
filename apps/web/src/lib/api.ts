import type {
  PaymentInitializeRequest,
  PaymentInitializeResponse,
  PaymentItem,
  PaymentVerification,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

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
    throw new ApiError(0, "NEXT_PUBLIC_API_URL is not set; no payment backend to call.");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        // Skips ngrok's HTML interstitial, which otherwise arrives instead
        // of JSON. Harmless against any other host.
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    // Network-level failure. Note an unreachable backend usually surfaces as a
    // CORS error: its error page carries no Access-Control-Allow-Origin.
    throw new ApiError(
      0,
      "Could not reach the payment service. It may be offline, or its address may have changed.",
    );
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      response.status,
      `Expected JSON from ${path} but got: ${text.slice(0, 120)}`,
    );
  }

  if (!response.ok) {
    const record = asRecord(body);
    const message =
      str(record?.error) ?? str(record?.message) ?? response.statusText ?? "Request failed";
    throw new ApiError(response.status, message);
  }

  return body as T;
}

/** POST /payments/initialize */
export async function initializePayment(
  body: PaymentInitializeRequest,
): Promise<PaymentInitializeResponse> {
  const raw = await request<unknown>("/payments/initialize", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const record = asRecord(raw);
  const authorizationUrl = str(record?.authorizationUrl);
  const reference = str(record?.reference);

  // Redirecting to `undefined` is a far worse failure than an error message.
  if (!authorizationUrl || !reference) {
    throw new ApiError(
      0,
      `Initialize response missing authorizationUrl/reference: ${JSON.stringify(raw).slice(0, 300)}`,
    );
  }

  return { authorizationUrl, reference };
}

// GET /payments/verify. Read `payment.status`, NOT the top-level `status` —
// the outer one reports whether the lookup worked, and says "success" even for
// a failed payment.
export async function verifyPayment(reference: string): Promise<PaymentVerification> {
  const raw = await request<unknown>(
    `/payments/verify?reference=${encodeURIComponent(reference)}`,
  );

  const payment = asRecord(asRecord(raw)?.payment);
  if (!payment) {
    throw new ApiError(0, `No payment in the verify response for ${reference}.`);
  }

  const status = str(payment.status) ?? "unknown";

  return {
    reference: str(payment.reference) ?? reference,
    // Anything unrecognised counts as unpaid.
    paid: status.toLowerCase() === "success",
    status,
    amount: num(payment.amount),
    currency: str(payment.currency),
    paidAt: str(payment.paidAt),
    channel: str(payment.channel),
    customerName: str(payment.customerName),
    items: readItems(payment.items),
  };
}

function readItems(value: unknown): PaymentItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = asRecord(entry);
    const name = str(item?.name);
    if (!name) return [];
    return [
      {
        name,
        size: str(item?.size) ?? "",
        quantity: num(item?.quantity) ?? 1,
        unitPrice: num(item?.unitPrice) ?? 0,
      },
    ];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
