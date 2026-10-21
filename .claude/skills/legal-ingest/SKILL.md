---
name: legal-ingest
description: Turn a raw ramble about Ken's employment / workers' comp case into structured case data and rebuild the lawyer-ready package. Use when Ken pastes case facts, says "ingest this", "add to the case", or fills in legal/INTAKE.md.
---
# Legal ingest loop (file-based, no server needed)

1. Read `legal/CA-EMPLOYMENT-LAW.md` and `legal/CASE-LAW.md` once per session.
2. Surface candidate statutes + deadlines from the text:
   `node legal/suggest-statutes.mjs --anchor <YYYY-MM-DD of the retaliatory act or injury> "<ramble>"`
3. Build the payload (schema in `legal/README.md`; `extract` block with
   `timeline / parties / evidence / claims / deadlines`). Put the **shortest
   deadline first** — a Labor Code §132a petition is 1 year from the
   retaliatory act, at the WCAB. Only attach statutes that genuinely fit.
4. Write it to a temp JSON file in the scratchpad, then:
   `node legal/ingest.mjs <file>`
5. `node legal/assemble-package.mjs --case-name "<name>" > legal/CASE-PACKAGE.md`
6. Commit `legal/` and push. Say plainly which deadlines are now on the clock.

Never state a deadline as certain — every statute of limitations has exceptions;
label them "verify with attorney". Not legal advice.
