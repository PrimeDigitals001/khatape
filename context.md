# Khatape — Product Context (for marketing)

> **How to use this file:** Paste this whole document into an LLM and ask it to produce marketing
> material — landing-page copy, taglines, WhatsApp/Instagram posts, a sales pitch deck outline,
> cold-DM scripts, feature one-pagers, comparison sheets, demo scripts, etc. Everything below is
> factual context about the product, who it's for, and what makes it different. Ask the LLM to keep
> claims to what's described here.

---

## 1. One-liner

**Khatape is a multi-tenant POS + *khaata* (running ledger) app for Indian dairy and grocery shops** —
tap an RFID card, sell packaged *and* loose goods, put it on the customer's running account, and close
the month with WhatsApp/thermal invoices. One operator runs many shops and switches features on
**per shop**.

Vision in one line: *the simplicity of a small-shop POS, but multi-tenant, loose-goods-ready,
module-gated per shop, and robust enough for a shop with 2,000+ customers from day one.*

---

## 2. Who it's for

- **Dairy shops** that sell milk by the litre and run **home-delivery rounds**.
- **Kirana / grocery shops** that sell both packaged items (a pouch, a bottle) and **loose goods**
  (grain, sugar, oil by weight/volume) and run a **khaata** (credit book) for regulars.
- **Milk-delivery businesses** that today track "how much each house took" on a **paper card**.
- **The operator (the seller / reseller)** — a single person/company who runs the platform and
  onboards many shops as paying clients, deciding which features each shop gets.

Typical client size at launch: **~1,000 RFID cards**, growing to **~2,400 customers**, with
**~500 purchases recorded per day**.

---

## 3. The problems it solves (the "before")

- **The paper khaata book** — handwritten credit ledgers that are slow, error-prone, and impossible
  to total or chase for payments.
- **The paper delivery card** — the milkman writes daily quantities by hand at each house, then
  manually tallies a monthly bill.
- **Loose-goods billing** — ordinary POS apps only handle fixed-price packaged items; they can't sell
  "₹40 of milk" or "1.5 kg of sugar".
- **No customer identity** — hard to instantly pull up a regular's account at the counter.
- **Month-end chaos** — totalling a month of purchases and partial payments by hand.
- **One-size software** — shops pay for features they don't need, or can't get the ones they do.

---

## 4. What it does (the "after") — core features

- **RFID-tap identity** — the customer taps their card; their account opens instantly at the counter.
- **Packaged *and* loose goods** — sell pouches by the piece **and** milk/grain/oil by g/kg/ml/l.
  - **Rupee-first entry**: punch **"₹50"** of milk → it computes the litres. Or enter **1.5 L** → it
    computes the price. Quick-amount and quick-quantity buttons for counter speed.
- **Khaata (running ledger)** — every purchase goes on the customer's account; the **due is always
  purchases − payments**, calculated live.
- **One payments ledger, no double-counting** — record a payment against a specific invoice **or**
  against the customer's account; either way it's one record. Account payments auto-apply to the
  oldest unpaid invoices first (FIFO). The invoice view and the customer row can never disagree.
- **Daily Delivery Round** — digitizes the paper card. The deliverer opens "Today's Round": a list of
  the route **pre-filled with each customer's usual quantity** → tap to confirm, adjust, or skip →
  each entry drops onto that customer's khaata. Month-end bills itself.
- **Tap & Go** — even faster: tap the card and the customer's **standing order is recorded straight
  onto their account** — no cart, no clicks (with a guard against accidental double-taps).
- **Monthly / bulk invoices** — generated on demand from the data, with a **UPI QR code** for instant
  payment, sent over **WhatsApp** and printed on a **Bluetooth thermal printer**.
- **Per-shop modules** — the operator turns features on/off **per shop** from a central console
  (loose items, delivery rounds, WhatsApp, thermal printing, GST, analytics, bulk import, prepaid
  wallet, etc.). A shop only sees what it's been granted.
- **Operator console** — create shops, grant/revoke their modules, and manage their logins centrally.
- **Shop settings** — each shop manages its own name, UPI ID, GST number, phone, and password.

---

## 5. What makes it different (key selling points)

1. **Loose goods done right** — sell by weight/volume with rupee-first entry. Most POS apps simply
   can't do this; it's the headline feature for dairies and kiranas.
2. **It replaces the paper card *and* the paper khaata** — the two things these shops actually live
   on, in one app.
3. **Two delivery flows** — a tap-down route list **and** one-tap card delivery, both feeding the same
   ledger. Built for how milk rounds actually work.
4. **Per-shop feature control** — the operator sells tiers: a basic shop gets the core POS; a bigger
   shop pays for delivery rounds, WhatsApp, GST, analytics. New features ship **off by default** and
   are switched on per shop — so a feature never disrupts a shop that didn't ask for it.
5. **Real multi-tenant security** — every shop's data is isolated at the database level
   (row-level security); one shop can never see another's.
6. **Money that doesn't drift** — amounts are handled as exact values, not floating-point, so totals
   stay correct across thousands of customers.
7. **Built for scale from day one** — designed for a 2,000+ customer shop, with fast, pre-aggregated
   balances so it stays snappy.
8. **WhatsApp + UPI QR invoices** — customers pay by scanning; receipts arrive on WhatsApp.

---

## 6. The business model (for the operator)

- **One platform, many shops.** A single shared backend serves every shop (multi-tenant), so infra
  cost is **flat and shared**, not per-shop. The operator's cost stays low even as shops are added.
- **Module tiers = upsell.** Core POS + khaata for everyone; charge more for delivery rounds,
  WhatsApp, GST, analytics, bulk import, etc. — toggled per shop instantly.
- **Low running cost.** At this scale the backend runs on a small, predictable monthly cost that one
  paying shop already covers — every additional shop is margin.
- **Fast onboarding.** Bulk-import a shop's existing customer list; assign RFID cards; go live.

---

## 7. Tech & trust signals (use sparingly in marketing, mostly for credibility)

- Modern web app (works on a counter tablet, phone for the delivery round).
- Postgres database with **row-level security** for true per-shop isolation.
- Secure logins; privileged actions run server-side only.
- A **tested core** for the money math (pricing, units, ledger, validation) — the part that must never
  be wrong.
- WhatsApp delivery, Bluetooth thermal printing, jsPDF invoices with UPI QR.

---

## 8. Tone & brand

- **Name:** Khatape (from *khaata* — the Indian credit ledger).
- **Voice:** practical, trustworthy, made-for-India, shopkeeper-friendly. Speak the language of a
  dairy/kirana owner, not a Silicon-Valley SaaS. Hinglish is welcome in customer-facing copy
  (e.g. *"₹50 ka doodh, ek tap mein."*).
- **Feel:** fast, simple, reliable — "your khaata book, but it does the maths and chases the dues."

---

## 9. Marketing angles to explore (prompts for the LLM)

- "Throw away the paper khaata book."
- "Sell milk by the litre, not just the pouch."
- "The milkman's round, on his phone."
- "₹50 ka doodh — one tap."
- "Every rupee accounted for, every month closed automatically."
- "One app, every shop, only the features each one needs."
- Comparison vs paper / vs generic POS / vs spreadsheets.

## 10. Suggested deliverables to ask the LLM for

- A landing-page hero (headline + subhead + 3 feature bullets + CTA).
- 5 Instagram/WhatsApp-status posts (Hinglish ok).
- A 30-second demo script for a shopkeeper.
- A one-page sales sheet for onboarding new shops.
- Cold-DM / referral scripts to reach dairy & kirana owners.
- An objection-handling FAQ (price, trust, "my book works fine", data safety).

---

*Note for the writer: keep claims to the features described above. Where a capability is a delivery
flow (Daily Round, Tap & Go) or loose-goods pricing, those are real and central — lead with them.*
