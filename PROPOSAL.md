# Manual bank-transfer store — proposal for review

Nothing here is the full app. This is the schema, the layout, and the parser
stub you asked to see first.

## Folder structure

    unbound-merch/
    ├─ package.json                       # npm workspaces root
    ├─ docker-compose.yml                 # postgres (no local psql on this machine)
    ├─ .env.example                       # written
    │
    ├─ packages/
    │  └─ db/                             # schema + every write that touches order state
    │     ├─ prisma/
    │     │  ├─ schema.prisma             # written
    │     │  └─ seed.ts                   # written — the six products + prices
    │     └─ src/
    │        ├─ client.ts                 # PrismaClient singleton
    │        ├─ money.ts                  # written — integer kobo
    │        ├─ reference.ts              # written — ORD-XXXXX codes
    │        ├─ categories.ts             # written — labels, slugs, shop order
    │        └─ orders/
    │           ├─ createOrder.ts         # order + items + reservations, one txn
    │           ├─ confirmPayment.ts      # ** the single mark-paid path **
    │           ├─ expireReservations.ts  # the sweep, with row locking
    │           └─ availableStock.ts      # stockQuantity − active reservations
    │
    └─ apps/
       ├─ web/                            # Next.js: storefront + admin
       │  ├─ public/products/             # written — drop product photos here
       │  │  ├─ tshirts/  jerseys/  scarves/  caps/  tote-bags/
       │  │  └─ README.md                 # exact filenames the seed expects
       │  └─ src/app/
       │     ├─ (shop)/                   # listing, product, cart, checkout
       │     │  └─ shop/[category]/       # /shop/tshirts, /shop/tote-bags ...
       │     ├─ orders/[reference]/       # payment instructions + countdown
       │     └─ admin/                    # order list, manual-review queue
       │
       └─ worker/                         # long-running; not serverless
          └─ src/
             ├─ index.ts                  # boots watcher + wa client + job loop
             ├─ imap/
             │  ├─ watcher.ts             # IDLE, falls back to polling
             │  ├─ normalize.ts           # mailparser -> NormalizedEmail
             │  ├─ verifySender.ts        # written — DKIM/SPF + allowlist gate
             │  ├─ ingest.ts              # store alert, parse, hand to matcher
             │  ├─ matcher.ts             # reference + amount -> confirmPayment
             │  └─ parsers/
             │     ├─ types.ts            # written
             │     ├─ registry.ts         # written
             │     ├─ generic-ng.ts       # written — PLACEHOLDER
             │     └─ __fixtures__/       # real emails, redacted, as test cases
             ├─ whatsapp/
             │  ├─ client.ts              # whatsapp-web.js lifecycle + QR
             │  ├─ governor.ts            # written — pacing, caps, warm-up
             │  ├─ health.ts              # ban/disconnect detection + alert
             │  ├─ send.ts                # sendWhatsAppMessage(phone, body)
             │  └─ inbound.ts             # read-only status lookup
             └─ jobs/
                ├─ loop.ts                # 60s tick
                ├─ expireReservations.job.ts
                └─ drainOutbox.job.ts     # sends pending Notification rows

## The one thing I want you to push back on first

Your security principle has a hole in it as written, and it is worth fixing
before any code goes on top of it.

"The only source of truth is the bank alert email" is only as strong as the
unforgeability of that email. By default it is not unforgeable: `From:` is free
text. Anyone who learns the alert mailbox address can send it a convincing
credit alert. The reference code is printed on the buyer's own payment page, so
an attacker already has every field the parser reads. That is free goods, with
no bank involved.

So `verifySender.ts` gates ingestion on two things: the sender domain is on
`ALERT_SENDER_ALLOWLIST`, **and** the mailbox provider's own
`Authentication-Results` header reports DKIM pass bound to that domain. Anything
else is stored as `rejected` — visible in the admin queue, never auto-matched.
Empty allowlist means nothing auto-matches, which is the safe default.

Two things I need from you for this: your bank's exact alert sender domain, and
confirmation that the alert mailbox is not an address that forwards mail in from
elsewhere (forwarding breaks DKIM and would send everything to manual review).

## Deviations from your brief

1. **Money is `BigInt` kobo, not a decimal price field.** The matcher does exact
   equality on amounts; float equality on money is a bug generator. Costs you a
   `serializeBigInts()` call at the client boundary.
2. **`StockReservation.released: boolean` became a 3-state enum**
   (`active` / `committed` / `released`). A boolean cannot distinguish "stock
   handed back because the order expired" from "stock permanently sold", and
   Phase 3 needs that distinction to decrement `stockQuantity` correctly.
3. **Added a `Notification` outbox table.** You asked that the storefront never
   call whatsapp-web.js directly, and that nothing double-sends. A row with a
   unique `dedupeKey` (`order:<id>:paid:buyer`) does both: web writes rows,
   the worker is the only sender, and the unique index makes a double-confirm
   physically incapable of double-messaging.
4. **Added `OrderEvent`** for the accountability logging you asked for on manual
   confirmation, generalised to every status transition.
5. **Added `AdminUser`** so `OrderEvent.actor` and `Order.confirmedByAdminId`
   can point at a real row. Seeded from env for now, as you suggested.
6. **`Order.confirmingBankAlertId` is `@unique`** — a database-level guarantee
   that one bank alert can never confirm two orders. Belt and braces around the
   application logic.

## Decisions I made where you left a choice

- **No Redis.** A 60-second `setInterval` in the worker plus Postgres
  `SELECT ... FOR UPDATE SKIP LOCKED` covers expiry sweeps and outbox draining
  at this volume. BullMQ earns its keep at multi-worker scale; adding Redis now
  is a third process to run and back up for no gain. Easy to swap later —
  the jobs are plain functions.
- **whatsapp-web.js, as you specified**, but behind `send.ts` so the rest of the
  app never imports it. See the trade-off note below.
- **Postgres via Docker** — you have Docker but no local `psql`.

## Keeping the WhatsApp number from getting banned

Calibrating this properly, because my first pass overstated the danger: plenty
of whatsapp-web.js bots run for years without ever being touched. Low-volume,
transactional, user-initiated bots — which is exactly what this is — are the
category that survives. The ban stories almost all come from cold outreach and
bulk marketing.

So the realistic risk here is low, not inevitable. What is true: it is
unofficial, WhatsApp's terms prohibit automated sending, and enforcement when
it does come is automated, unannounced, and hard to appeal. That combination
argues for cheap precautions and a graceful failure path, not for anxiety.

### What actually gets numbers banned

Volume is not the main driver, which is where most advice goes wrong. The
dominant signal is **recipient-side**: how many people block you, tap "Report
spam", or never reply. A number sending 300 messages a day to people who all
reply is safer than one sending 15 a day to strangers who block it.

That is good news here, because our traffic is structurally the safe kind: we
only ever message someone who typed their own number into our checkout minutes
earlier and just sent us money, about that specific order. That single fact is
worth more than every technical mitigation below.

### The controls, strongest first

1. **Never message a number that did not initiate.** No marketing, no
   broadcasts, no "we miss you" campaigns, no importing a contact list. The
   moment this number is used for promotion, the risk profile changes
   completely. This is a policy commitment, not a code change — and it is the
   one I would hold hardest.
2. **Warm the number up.** A number that has never sent anything and then emits
   200 messages on day one is the most bannable pattern there is. Ramp
   geometrically: 20/day at launch reaching full volume over two weeks
   (`effectiveDailyCap` in `governor.ts` — 20 → 23 → 63 → 200 across days
   0/1/7/14). Also: do not use a freshly-bought SIM. An aged number with real
   conversation history on it survives scrutiny far better.
3. **Pace and jitter every send.** 8s minimum gap plus up to 7s of randomness,
   with hourly and daily caps. Machine-regular cadence is detectable; the
   counters read from the `WhatsAppMessage` table rather than memory, so a
   worker restart cannot reset the budget and burst.
4. **Validate the number before sending.** Buyers mistype phone numbers
   constantly, and firing messages at numbers that are not on WhatsApp is
   exactly what scrape-and-blast operations look like. `resolveRecipient()`
   calls `getNumberId()` first and fails the notification loudly instead.
5. **Vary the message body.** Identical strings repeated N times read as a
   broadcast. Our messages already carry order-specific data; `varyOpening()`
   rotates the opener so two same-minute confirmations still differ.
6. **Go easy on links.** Link shorteners are heavily correlated with spam
   classification. Use a plain full domain, one link at most, and prefer
   putting the order reference in text over a URL.
7. **Respect quiet hours and opt-out.** Nothing non-urgent between 22:00 and
   07:00 WAT. Honour "STOP" as a permanent suppression on that number.
8. **Keep the session stable.** Frequent re-pairing from changing IPs looks
   like account takeover. Run the worker from one stable IP, ideally hosted in
   the same region as the phone, and put `WHATSAPP_SESSION_PATH` on a
   persistent volume. Note the phone must reconnect at least once every ~14
   days or linked devices are logged out.
9. **Use a WhatsApp Business profile** on the number — a filled-in business
   name, category and address. It costs nothing and reads as legitimate.

### If it happens anyway

Unlikely, but cheap to prepare for. Three things turn it from an outage into a
bad afternoon:

- **Detect it.** whatsapp-web.js emits `disconnected` and auth-failure events.
  Catch them, mark the session dead, stop draining the outbox, and alert you
  over the fallback channel (`FALLBACK_ALERT_EMAIL`).
- **Do not lose messages.** Because sending goes through the `Notification`
  outbox, a dead session means rows pile up as `pending`, not vanish. When a
  new number is paired, the backlog drains — the `dedupeKey` unique constraint
  still guarantees nobody gets messaged twice.
- **Make the number swappable.** `SELLER_WHATSAPP_NUMBER` and the session path
  are env vars; recovery is pair a second number and restart the worker.
  Keeping a spare number already warmed up turns hours into minutes.

None of this touches order correctness. A ban delays notifications; it cannot
mark an order paid or unpaid, because that path only ever runs off a verified
bank alert.

### When to move to the Cloud API

No reason to pre-emptively migrate. The trigger is a first ban, or the point
where you start wanting to send anything promotional — that is the use case
whatsapp-web.js genuinely cannot carry. The WhatsApp Cloud API is the sanctioned path — it will not get banned
for automation, and is free for service conversations within Meta's limits. The
costs are Business verification, and pre-approved templates for
business-initiated messages. Because everything goes through
`sendWhatsAppMessage()` and the outbox, that migration is one adapter file, not
a rewrite. I would build it that way now and not do the migration yet.

## Parser strategy

`generic-ng.ts` is a deliberately conservative placeholder. It refuses rather
than guesses, in three places that should survive calibration against your real
email:

- **Direction.** No positive credit signal, or both credit and debit words
  present, means refuse. A ₦45,000 *debit* alert must never confirm a ₦45,000
  order. Verified against a test case.
- **Balance figures are stripped before amount selection.** `Available Balance:
  ₦45,000.00` is the classic false positive.
- **Two candidate amounts, or two candidate references, means manual review.**
  Not a coin flip — guessing risks crediting the wrong buyer.

References are recovered in two passes: strict (word-bounded) and loose
(`TRFORD7F3K2FROMJOHN`, which banks really do produce). Loose hits are flagged
in `parseNotes` so you can see them in review. The alphabet excludes `0 1 I L O
U` because a human retypes this into a bank app from a screenshot.

I ran the stub against eight synthetic alerts — labelled-amount, balance trap,
debit-with-matching-amount, mangled reference, double reference, missing
reference, an HTML table template, and a bare number with no currency. It
extracted correctly on five and refused the three it should have refused.

**What I need from you:** one real credit alert, raw source
(Gmail → Show original), lightly redacted — keep the headers, the amount
formatting, and the narration line intact. I will add a bank-specific parser
module and turn your sample into a fixture test, rather than loosening the
generic one.

## Catalogue

Seeded from your price list in `packages/db/prisma/seed.ts`:

| Product | Category | Price |
|---|---|---|
| T-Shirt 1 | T-Shirts | ₦9,000 |
| T-Shirt 2 | T-Shirts | ₦8,500 |
| Jersey | Jerseys | ₦17,000 |
| Scarf | Scarves | ₦7,000 |
| Cap | Caps | ₦5,000 |
| Tote Bag | Tote Bags | ₦5,000 |

`Category` is an enum (`tshirts`, `jerseys`, `scarves`, `caps`, `tote_bags`)
rather than a table — the set is small and stable, and typo-proofing it at the
database level is worth more than letting categories be invented at runtime.
Display names and shop ordering live in `packages/db/src/categories.ts`.

**stockQuantity is a placeholder of 20 on every product** so the storefront is
usable in development. Send me the real counts before launch — that number is
what the whole reservation system protects.

Images go in `apps/web/public/products/<category>/`, one folder per line, with
a README listing the exact filenames the seed already points at.

## Open questions

0. **Sizes.** T-shirts and jerseys almost certainly need S/M/L/XL, and the
   schema has no variant concept — `Product` carries one price and one stock
   count. This is not cosmetic: stock reservation operates on whatever the
   stocked unit is, so if a Jersey has four sizes, reserving "1 Jersey" is
   wrong and will oversell. Two options: add a `ProductVariant` table (correct,
   ~half a day), or list each size as its own product (ugly, works today).
   Tell me which and I'll do it before Phase 1 — retrofitting variants after
   orders exist is far more painful.


1. Bank alert sender domain, and does the mailbox receive alerts directly or by
   forwarding?
2. Physical goods, digital, or both? Decides whether delivery address is
   required and what the post-payment WhatsApp message promises.
3. **Underpayment and overpayment.** Right now a ₦44,900 transfer against a
   ₦45,000 order does not auto-match — it lands in manual review. Correct? Or
   should a near-miss above some threshold auto-confirm?
4. **Two pending orders for the same amount, alert with no reference.** Manual
   review with both shown as candidates, I assume — confirm.
5. Is 15 minutes right? For a manual bank transfer that is tight, especially if
   the buyer has to open another app and their bank is slow. 30–60 minutes may
   cost you fewer abandoned carts than it costs in held stock.
