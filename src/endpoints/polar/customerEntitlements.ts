import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { getCustomerEntitlements } from "../../polar/store";
import { entitlement } from "./entitlementList";

export class CustomerEntitlements extends OpenAPIRoute {
  public schema = {
    tags: ["Polar"],
    summary: "Resolve a customer's capability set",
    description:
      "The union of capability flags across a customer's currently granting " +
      "subscriptions — the answer an authorization check needs. A customer " +
      "with no granting subscription resolves to an empty set, never an error.",
    operationId: "polar-customer-entitlements",
    request: {
      params: z.object({
        customer: z
          .string()
          .describe("Polar customer id or external customer id"),
      }),
    },
    responses: {
      "200": {
        description: "Resolved capabilities for the customer",
        ...contentJson({
          success: z.literal(true),
          result: z.object({
            customer: z.string(),
            capabilities: z.array(z.string()),
            subscriptions: z.array(entitlement),
          }),
        }),
      },
    },
  };

  public async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { customer } = data.params;

    const { capabilities, subscriptions } = await getCustomerEntitlements(
      c.env.DB,
      customer,
    );

    return {
      success: true,
      result: { customer, capabilities, subscriptions },
    };
  }
}
