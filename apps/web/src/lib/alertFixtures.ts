/**
 * Raw-email fixtures for exercising the ingestion pipeline without a bank.
 *
 * These are full RFC822 messages, not shortcuts, because the parts that matter
 * most are the headers: `Authentication-Results` is what verifySender reads,
 * and it is the single control standing between this system and "anyone who
 * knows the mailbox address gets free goods". A fixture that skipped headers
 * would test everything except the thing worth testing.
 */
export interface AlertFixture {
  id: string;
  label: string;
  /** What should happen, so the review queue can be checked against intent. */
  expectation: string;
  build(args: { reference: string; amount: string }): string;
}

const now = () => new Date().toUTCString();
const mid = () => `${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;

/** Gmail's own verdict line for a genuinely DKIM-signed GTBank message. */
const PASSING_AUTH =
  "mx.google.com;\r\n" +
  "       dkim=pass header.i=@gtbank.com header.s=selector1 header.b=Ab1Cd2Ef;\r\n" +
  "       spf=pass (google.com: domain of alerts@gtbank.com designates 41.58.0.1 as permitted sender) smtp.mailfrom=alerts@gtbank.com;\r\n" +
  "       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=gtbank.com";

const FAILING_AUTH =
  "mx.google.com;\r\n" +
  "       dkim=none;\r\n" +
  "       spf=softfail (google.com: domain of transitioning alerts@gtbank.com does not designate 203.0.113.9 as permitted sender) smtp.mailfrom=alerts@gtbank.com;\r\n" +
  "       dmarc=fail (p=REJECT sp=REJECT dis=QUARANTINE) header.from=gtbank.com";

function message(opts: {
  from: string;
  auth: string;
  subject: string;
  body: string;
}): string {
  return [
    `Return-Path: <${opts.from}>`,
    `Authentication-Results: ${opts.auth}`,
    `Message-ID: <${mid()}@mail.local>`,
    `Date: ${now()}`,
    `From: GTBank Alerts <${opts.from}>`,
    `To: alerts@yourdomain.com`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    opts.body,
  ].join("\r\n");
}

export const FIXTURES: AlertFixture[] = [
  {
    id: "valid-credit",
    label: "Genuine credit alert (should confirm the order)",
    expectation:
      "Sender verified by DKIM, amount and reference both extracted, order marked paid.",
    build: ({ reference, amount }) =>
      message({
        from: "alerts@gtbank.com",
        auth: PASSING_AUTH,
        subject: "GTBank Credit Alert",
        body:
          `Dear Customer,\n\n` +
          `Your account has been CREDITED.\n\n` +
          `Transaction Amount: NGN ${amount}\n` +
          `Account: ****6789\n` +
          `Narration: TRF FROM JOHN ADEYEMI ${reference}\n` +
          `Available Balance: NGN 2,481,300.55\n` +
          `Value Date: ${new Date().toDateString()}\n\n` +
          `Thank you for banking with us.\n`,
      }),
  },
  {
    id: "forged-sender",
    label: "Forged alert from an attacker (must be rejected)",
    expectation:
      "From: says gtbank.com but DKIM does not pass for it. Stored as `rejected` and never auto-matched — this is the attack the allowlist exists to stop.",
    build: ({ reference, amount }) =>
      message({
        from: "alerts@gtbank.com",
        auth: FAILING_AUTH,
        subject: "GTBank Credit Alert",
        body:
          `Your account has been CREDITED.\n\n` +
          `Transaction Amount: NGN ${amount}\n` +
          `Narration: TRF ${reference}\n`,
      }),
  },
  {
    id: "wrong-domain",
    label: "Right DKIM, wrong domain (must be rejected)",
    expectation:
      "A properly signed message from a domain that is not on the allowlist. Signature validity is not enough — it has to be signed by the bank.",
    build: ({ reference, amount }) =>
      message({
        from: "alerts@totally-not-gtbank.com",
        auth:
          "mx.google.com;\r\n       dkim=pass header.i=@totally-not-gtbank.com header.s=s1;\r\n       spf=pass smtp.mailfrom=alerts@totally-not-gtbank.com",
        subject: "Credit Alert",
        body: `CREDITED\n\nTransaction Amount: NGN ${amount}\nNarration: ${reference}\n`,
      }),
  },
  {
    id: "debit-trap",
    label: "Debit alert for the same amount (must be ignored)",
    expectation:
      "Correctly signed and the amount matches exactly — but money left the account. Must never confirm anything.",
    build: ({ reference, amount }) =>
      message({
        from: "alerts@gtbank.com",
        auth: PASSING_AUTH,
        subject: "GTBank Debit Alert",
        body:
          `Your account has been DEBITED.\n\n` +
          `Transaction Amount: NGN ${amount}\n` +
          `Narration: POS PURCHASE ${reference}\n` +
          `Available Balance: NGN 2,400,000.00\n`,
      }),
  },
  {
    id: "balance-trap",
    label: "No amount label, balance line present (must refuse)",
    expectation:
      "The only currency figure on the page is the account balance. The parser must strip balance lines and then refuse rather than confirm an order for the balance.",
    build: ({ reference }) =>
      message({
        from: "alerts@gtbank.com",
        auth: PASSING_AUTH,
        subject: "GTBank Transaction Notification",
        body:
          `A credit transaction occurred on your account.\n\n` +
          `Available Balance: NGN 45,000.00\n` +
          `Narration: TRF ${reference}\n`,
      }),
  },
  {
    id: "mangled-reference",
    label: "Reference mangled by the bank template (loose match)",
    expectation:
      "The bank glued the reference to surrounding text. Recovered by loose matching and accepted only because the amount matches exactly; the review notes say so.",
    build: ({ reference, amount }) =>
      message({
        from: "alerts@gtbank.com",
        auth: PASSING_AUTH,
        subject: "GTBank Credit Alert",
        body:
          `CREDIT\n\n` +
          `Transaction Amount: NGN ${amount}\n` +
          `Narration: TRF${reference.replace("-", "")}FROMJOHNADEYEMI\n` +
          `Available Balance: NGN 2,481,300.55\n`,
      }),
  },
  {
    id: "no-reference",
    label: "Correct amount, no reference (manual review)",
    expectation:
      "A real transfer where the buyer forgot the narration. Must land in review listing same-amount candidates, never auto-confirm one of them.",
    build: ({ amount }) =>
      message({
        from: "alerts@gtbank.com",
        auth: PASSING_AUTH,
        subject: "GTBank Credit Alert",
        body:
          `Your account has been CREDITED.\n\n` +
          `Transaction Amount: NGN ${amount}\n` +
          `Narration: TRF FROM JOHN ADEYEMI\n` +
          `Available Balance: NGN 2,481,300.55\n`,
      }),
  },
  {
    id: "underpayment",
    label: "Underpayment by ₦1 (must not auto-confirm)",
    expectation:
      "Reference matches, amount is one naira short. Refused into review — near-misses are logged, never rounded into a match.",
    build: ({ reference, amount }) => {
      const short = (Number(amount.replace(/,/g, "")) - 1).toLocaleString("en-US");
      return message({
        from: "alerts@gtbank.com",
        auth: PASSING_AUTH,
        subject: "GTBank Credit Alert",
        body:
          `Your account has been CREDITED.\n\n` +
          `Transaction Amount: NGN ${short}\n` +
          `Narration: TRF ${reference}\n`,
      });
    },
  },
];
