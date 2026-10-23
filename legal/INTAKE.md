# Case Intake — fill this in, the machine does the rest

The legal pipeline is built but EMPTY. This sheet is the one missing input.
Fill in what you know (voice-dictate it, rough is fine — that's the point),
hand it to any Claude, and it runs: `suggest-statutes.mjs` → `ingest.mjs` →
`assemble-package.mjs` → lawyer-ready `CASE-PACKAGE.md` with a live SOL clock.

**Why this is urgent:** the §132a retaliation petition clock is **1 year from
the retaliatory act**, at the WCAB, and it's the shortest fuse in the case.
Until the dates below are in, nobody can compute how much of that year is left.

> Not legal advice. This organizes facts for an attorney — it doesn't replace one.

---

## 1. The anchor dates (the SOL clock runs off these — most important section)

- Date of injury: ____________
- Date you filed the workers' comp claim (DWC-1 form): ____________
- Date of EACH thing done to you after filing (firing / demotion / hours cut /
  write-up / schedule punishment — one line per event, with date): ____________
- If terminated: exact last day worked and how you were told: ____________
- Date of each adjuster lie / false statement / denial you know of: ____________

## 2. The players

- Your full legal name: ____________
- Employer legal name (check a paystub — exact wording): ____________
- Supervisor(s) involved, names + titles: ____________
- Workers' comp insurance carrier name: ____________
- Adjuster name(s) + claim number: ____________
- Any witnesses (coworkers who saw the treatment change): ____________

## 3. The injury & claim

- What happened / what's injured: ____________
- Current medical status (treating, restrictions, MMI?): ____________
- Benefits received so far, and any that stopped — with the date they stopped: ____________

## 4. The retaliation story (talk, don't write — ramble is fine)

How were you treated before the claim vs after? What exactly changed, when,
and who did it? Were non-injured coworkers treated differently in the same
situation? (*Lauher* makes that comparison the whole ballgame.)

## 5. The adjuster conduct

What did the adjuster say or do that was false? To whom? In writing or on the
phone? Did it delay or deny a payment? (Lies → §1871.4 fraud referral;
delays → §5814 penalty petition, 2 yrs from each missed payment.)

## 6. Evidence you have or can get

Texts, emails, write-ups, paystubs, schedules, voicemails, denial letters,
claim correspondence, photos — list each with where it lives (phone, email,
a drawer). Don't filter; "mentioned" is a valid status.

---

## For the Claude that receives this

1. `node legal/suggest-statutes.mjs --anchor <retaliation date> "<Ken's text>"`
2. Build the `extract` block (schema in `legal/README.md` / `MASTER-SPEC.md`),
   shortest deadlines first — the §132a 1-year clock leads.
3. `node legal/ingest.mjs payload.json` →
   `node legal/assemble-package.mjs --case-name "..." > legal/CASE-PACKAGE.md`
4. Commit + push. Read `legal/CASE-LAW.md` before advising on strategy.
