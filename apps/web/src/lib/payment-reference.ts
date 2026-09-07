// Fallback for a callback that arrives without `?reference`. sessionStorage,
// not localStorage: it belongs to this one checkout.
export const LAST_REFERENCE_KEY = "unbound-payment-reference";

export function rememberReference(reference: string): void {
  try {
    window.sessionStorage.setItem(LAST_REFERENCE_KEY, reference);
  } catch {
    // Private mode or blocked storage. The query string covers the normal path.
  }
}

export function recallReference(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_REFERENCE_KEY);
  } catch {
    return null;
  }
}

export function forgetReference(): void {
  try {
    window.sessionStorage.removeItem(LAST_REFERENCE_KEY);
  } catch {
    // Nothing to clean up if storage was never reachable.
  }
}
