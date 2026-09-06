"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manuallyConfirm } from "@/app/admin/actions";

/**
 * Manual confirmation always demands a note. The note becomes OrderEvent.detail
 * and is the accountability record for a payment that no bank alert proved —
 * which is exactly the case where, months later, someone needs to know why
 * this order was marked paid.
 */
export function ConfirmButton({ orderId, reference }: { orderId: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: 12 }}
        onClick={() => setOpen(true)}>
        Confirm by hand
      </button>
    );
  }

  return (
    <div className="stack" style={{ gap: 6, minWidth: 200 }}>
      <input
        autoFocus placeholder={`How did you verify ${reference}?`}
        value={note} onChange={(e) => setNote(e.target.value)}
        style={{ fontSize: 12, padding: "6px 8px" }}
      />
      {error && <span style={{ color: "var(--danger)", fontSize: 11 }}>{error}</span>}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="btn" style={{ padding: "5px 10px", fontSize: 12 }} disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await manuallyConfirm(orderId, note);
              if (result.error) setError(result.error);
              else { setOpen(false); router.refresh(); }
            })
          }
        >
          {pending ? "…" : "Confirm"}
        </button>
        <button className="btn-link" onClick={() => { setOpen(false); setError(null); }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
