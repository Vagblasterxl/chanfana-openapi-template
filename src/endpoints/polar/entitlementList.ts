import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { listEntitlements } from "../../polar/store";

export const entitlement = z.object({
  subscription_id: z.string(),
  customer_id: z.string(),
  external_customer_id: z.string().nullable(),
  product_id: z.string(),
  product_name: z.string().nullable(),
  status: z.string(),
  active: z.boolean(),
  capabilities: z.array(z.string()),
  source: z.string(),
  event_type: z.string(),
  event_id: z.string(),
  occurred_at: z.string(),
  updated_at: z.string(),
});

export class EntitlementList extends OpenAPIRoute {
  public schema = {
    tags: ["Polar"],
    summary: "List subscription entitlements",
    description:
      "Entitlements as last reported by a verified Polar webhook. This is a " +
      "cache of Polar's state, not an independent source of truth.",
    operationId: "polar-entitlement-list",
    request: {
      query: z.object({
        customer: z
          .string()
          .optional()
          .describe("Polar customer id or external customer id"),
        product_id: z.string().optional(),
        active: z
          .enum(["true", "false"])
          .optional()
          .describe("Restrict to subscriptions that currently grant capabilities"),
      }),
    },
    responses: {
      "200": {
        description: "Matching entitlements, most recently updated first",
        ...contentJson({
          success: z.literal(true),
          result: z.array(entitlement),
        }),
      },
    },
  };

  public async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { customer, product_id, active } = data.query;

    const result = await listEntitlements(c.env.DB, {
      customer,
      product_id,
      active: active === undefined ? undefined : active === "true",
    });

    return { success: true, result };
  }
}
