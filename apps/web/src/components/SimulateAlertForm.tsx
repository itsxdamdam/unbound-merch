"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulateAlert } from "@/app/admin/actions";
import { FIXTURES } from "@/lib/alertFixtures";

/**
 * Development stand-in for the IMAP watcher.
 *
 * It writes a raw message into the same table the watcher writes to, and then
 * stops — the worker verifies, parses and matches it exactly as it will in
 * production. So this tests the real pipeline rather than a parallel one.
 */
export function SimulateAlertForm({
  defaultReference = "ORD-XXXXX",
  defaultAmount = "17,000.00",
}: {
  defaultReference?: string;
  defaultAmount?: string;
}) {
  const [fixtureId, setFixtureId] = useState(FIXTURES[0].id);
  const [reference, setReference] = useState(defaultReference);
  const [amount, setAmount] = useState(defaultAmount);
  const [raw, setRaw] = useState("");
  const [edited, setEdited] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const fixture = FIXTURES.find((f) => f.id === fixtureId)!;

  // Regenerate as the inputs change, unless the raw text has been hand-edited
  // — clobbering someone's paste of a real alert would be infuriating.
  useEffect(() => {
    if (edited) return;
    setRaw(fixture.build({ reference, amount }));
  }, [fixture, reference, amount, edited]);

  return (
    <div className="panel stack">
      <div className="row-split">
        <h2 style={{ margin: 0 }}>Simulate an incoming alert</h2>
        <span className="muted" style={{ fontSize: 12 }}>stands in for IMAP in development</span>
      </div>

      <div>
        <label htmlFor="fixture">Scenario</label>
        <select
          id="fixture" value={fixtureId}
          onChange={(e) => { setFixtureId(e.target.value); setEdited(false); setResult(null); }}
        >
          {FIXTURES.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <p className="hint">{fixture.expectation}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label htmlFor="ref">Order reference</label>
          <input
            id="ref" className="mono" value={reference}
            onChange={(e) => { setReference(e.target.value.toUpperCase()); setEdited(false); }}
          />
          <p className="hint">Copy it from the orders list.</p>
        </div>
        <div>
          <label htmlFor="amt">Amount (naira)</label>
          <input
            id="amt" className="mono" value={amount}
            onChange={(e) => { setAmount(e.target.value); setEdited(false); }}
          />
          <p className="hint">Must equal the order total exactly.</p>
        </div>
      </div>

      <div>
        <label htmlFor="raw">Raw message (editable — paste a real one here)</label>
        <textarea
          id="raw" rows={12} className="mono" style={{ fontSize: 12 }}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setEdited(true); }}
        />
      </div>

      {result?.error && <div className="notice notice-error">{result.error}</div>}
      {result?.ok && <div className="notice notice-info">{result.ok}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          className="btn" disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await simulateAlert(raw);
              setResult(r);
              router.refresh();
            })
          }
        >
          {pending ? "Delivering…" : "Deliver to mailbox"}
        </button>
        {edited && (
          <button className="btn-link" onClick={() => setEdited(false)}>
            Reset to scenario template
          </button>
        )}
      </div>
    </div>
  );
}
