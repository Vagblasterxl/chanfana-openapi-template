import { Hono } from "hono";
import { fromHono } from "chanfana";
import { RambleIngest } from "./rambleIngest";
import { RambleList } from "./rambleList";
import { CaseTimeline } from "./caseTimeline";
import { CaseParties } from "./caseParties";
import { CaseEvidence } from "./caseEvidence";
import { CaseClaims, CaseClaimUpsert } from "./caseClaims";
import { CaseDeadlines, CaseDeadlineCreate } from "./caseDeadlines";
import { CasePackage } from "./casePackage";

export const legalRouter = fromHono(new Hono());

// Ingest + raw rambles
legalRouter.post("/ramble", RambleIngest);
legalRouter.get("/rambles", RambleList);

// Structured case views
legalRouter.get("/timeline", CaseTimeline);
legalRouter.get("/parties", CaseParties);
legalRouter.get("/evidence", CaseEvidence);

// Claims (read + upsert with researched statutes)
legalRouter.get("/claims", CaseClaims);
legalRouter.post("/claims", CaseClaimUpsert);

// Deadlines / SOL clock (read + create)
legalRouter.get("/deadlines", CaseDeadlines);
legalRouter.post("/deadlines", CaseDeadlineCreate);

// The deliverable
legalRouter.get("/package", CasePackage);
