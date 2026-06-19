# California Employment & Workers' Comp Law — Reference

Curated, verified reference of the California statutes that matter for
**employment, wage & hour, retaliation, FEHA, and workers' compensation**
claims. Machine-readable version: `legal/ca-employment-law.json`. Matcher:
`node legal/suggest-statutes.mjs "<your situation>"`.

> **NOT legal advice.** Statute-of-limitations rules carry many exceptions —
> tolling, continuing-violation doctrine, equitable estoppel, and mandatory
> agency-filing prerequisites (CRD for FEHA, WCAB for workers' comp, LWDA for
> PAGA). **Every citation and deadline must be confirmed with an attorney.**
> Last verified 2026-06-19.

---

## Wage & Hour

| Claim | Statute | Statute of Limitations |
|---|---|---|
| Minimum wage | Labor Code §§ 1194, 1197 | 3 yrs (4 w/ UCL) |
| Overtime | Labor Code §§ 510, 1194 | 3 yrs (4 w/ UCL) |
| Meal & rest breaks | Labor Code §§ 226.7, 512 | 3 yrs |
| Final pay / waiting-time penalty | Labor Code §§ 201–203 | 3 yrs |
| Inaccurate wage statements | Labor Code § 226 | 1 yr (penalties) |
| Business expense reimbursement | Labor Code § 2802 | 3 yrs (4 w/ UCL) |
| PAGA civil penalties | Labor Code §§ 2698–2699 | 1 yr + mandatory LWDA notice |

**Key 2026 numbers:** statewide minimum wage **$16.90/hr** (many cities higher);
overtime at **1.5×** after 8 hrs/day or 40 hrs/week, **2×** after 12 hrs/day;
**30-min meal** break per 5 hrs, **paid 10-min rest** per 4 hrs; missed-break
remedy is **1 hour of premium pay per day** (one for meal, one for rest).
Waiting-time penalty = the daily wage for **each day late, up to 30 days**.

---

## Retaliation & Whistleblower

| Claim | Statute | Statute of Limitations |
|---|---|---|
| Whistleblower retaliation | Labor Code § 1102.5 | 3 yrs (90-day presumption) |
| Wage-complaint / protected-conduct retaliation | Labor Code § 98.6 | ~3 yrs civil (shorter for DLSE) |
| Safety-complaint retaliation / refuse unsafe work | Labor Code §§ 6310, 6311 | ~3 yrs civil |
| **Workers' comp retaliation** | **Labor Code § 132a** | **1 yr — WCAB petition** |

**§1102.5** has a built-in edge: if the adverse action lands **within 90 days**
of protected whistleblowing, retaliation is **presumed** and the employer must
disprove it.

**§132a is the sharp one** — only **one year** to file the petition with the
WCAB, and it's a hard deadline. If a workers'-comp claim was followed by firing,
demotion, or other punishment, this clock is likely the most urgent in the case.

---

## FEHA (Fair Employment & Housing Act) — Gov. Code § 12940 et seq.

| Claim | Statute | Statute of Limitations |
|---|---|---|
| Discrimination | Gov. Code § 12940(a) | CRD complaint within **3 yrs**, then **1 yr** from right-to-sue |
| Harassment / hostile environment | Gov. Code § 12940(j) | same (3 yrs from last incident) |
| Retaliation | Gov. Code § 12940(h) | same |
| Failure to accommodate / interactive process | Gov. Code § 12940(m), (n) | same |
| CFRA family/medical leave | Gov. Code § 12945.2 | same |

**FEHA's two-step clock:** you must **first file with the Civil Rights
Department (CRD)** within **3 years** of the violation, get a **right-to-sue**
notice, then file the lawsuit within **1 year** of that notice. Skipping the CRD
step (administrative exhaustion) can sink an otherwise good claim.

Protected characteristics include race, sex/gender, gender identity, sexual
orientation, age (40+), disability, medical condition, religion, national
origin, and more. The **failure-to-accommodate** claims (m/n) often pair with a
workers'-comp injury that left medical restrictions the employer ignored.

---

## Wrongful Termination

| Claim | Basis | Statute of Limitations |
|---|---|---|
| Wrongful termination in violation of public policy (*Tameny*) | Common law; CCP § 335.1 | **2 yrs** from termination |

A standalone tort: firing someone for a reason that offends a fundamental public
policy — e.g., **for filing a workers' comp claim**, refusing to do something
illegal, reporting unsafe conditions, or taking protected leave. **No CRD
exhaustion** required for the public-policy tort itself, which makes it a common
companion claim.

---

## Workers' Compensation

| Claim | Statute | Statute of Limitations |
|---|---|---|
| Work-injury benefits | Labor Code §§ 3600, 5405 | **1 yr** from injury (WCAB) |
| Retaliation for comp claim | Labor Code § 132a | **1 yr** from retaliatory act (WCAB) |

Workers' comp is the **exclusive remedy** against the employer for most on-the-job
injuries and is handled at the **WCAB**, not civil court. The injury claim runs
**1 year from the date of injury** (longer for cumulative trauma, or where the
employer never handed over a claim form). A §132a retaliation petition is a
**separate** 1-year clock.

---

## How a Claude uses this reference

When Ken rambles about his employment situation:

1. Run the matcher on the raw text to surface candidate statutes:
   ```bash
   node legal/suggest-statutes.mjs --anchor <termination-or-injury-date> "<the ramble>"
   ```
2. Pick the statutes that genuinely fit (don't over-attach — read `covers`).
3. Build the `extract.claims` with the real `statute` strings, and add
   `extract.deadlines` using the computed SOL dates (especially any **1-year**
   §132a / workers'-comp clocks — those go first).
4. `node legal/ingest.mjs payload.json` then
   `node legal/assemble-package.mjs > legal/CASE-PACKAGE.md`.

**Triage rule:** surface the shortest deadline first. A §132a or workers'-comp
injury clock (1 year) can expire long before a wage claim (3 years) — the case
package's SOL table is there so nothing lapses.

---

## Sources

- [Employee Rights Under California Wage & Hour Laws (2026)](https://www.kbhllp.com/blog/employee-rights-under-california-wage-and-hour-laws/)
- [California Wage and Hour Laws — LegalClarity](https://legalclarity.org/california-wage-and-hour-laws-overtime-breaks-pay/)
- [California Meal & Rest Break Law (2026)](https://www.classlawgroup.com/employment/california-labor-law/meal-rest-break-laws)
- [Labor Code § 132a — Workers' Comp Retaliation (Shouse)](https://www.shouselaw.com/ca/workerscomp/retaliation/labor-code-132a/)
- [Labor Code § 1102.5 — Whistleblower (Shouse)](https://www.shouselaw.com/ca/labor/labor-code-1102-5/)
- [FEHA Statute of Limitations (Setyan)](https://setyanlaw.com/meeting-feha-statute-limitations/)
- [Gov. Code § 12940 FEHA Protections (Setareh)](https://www.setarehlaw.com/california-government-code-12940-feha/)
- [CACI No. 2505 — FEHA Retaliation Elements (Justia, 2026)](https://www.justia.com/trials-litigation/docs/caci/2500/2505/)
- [103 Laws Protecting California Employees (Ottinger)](https://www.ottingerlaw.com/blog/103-laws-protecting-california-employees/)
