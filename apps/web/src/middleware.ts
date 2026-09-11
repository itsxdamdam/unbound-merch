import { NextResponse, type NextRequest } from "next/server";
import { STORE_OPEN } from "@/lib/store";

export function middleware(request: NextRequest) {
  if (STORE_OPEN) return NextResponse.next();
  // 307, not 308: a permanent redirect would be cached by browsers and keep
  // sending people home after the shop reopens.
  return NextResponse.redirect(new URL("/", request.url), 307);
}

export const config = {
  // Everything except "/" itself, Next internals, and files with an extension
  // (product photos, logo, backdrop) — those must keep loading on the landing
  // page.
  matcher: ["/((?!_next/|.*\\..*).+)"],
};
