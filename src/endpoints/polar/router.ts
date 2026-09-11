import { fromHono } from "chanfana";
import { Hono } from "hono";
import { CustomerEntitlements } from "./customerEntitlements";
import { EntitlementList } from "./entitlementList";
import { PolarWebhook } from "./webhook";

export const polarRouter = fromHono(new Hono());

polarRouter.post("/webhook", PolarWebhook);
polarRouter.get("/entitlements", EntitlementList);
polarRouter.get("/entitlements/:customer", CustomerEntitlements);
