import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { tasksRouter } from "./endpoints/tasks/router";
import { assetsRouter } from "./endpoints/assets/router";
import { agentsRouter } from "./endpoints/agents/router";
import { messagesRouter } from "./endpoints/messages/router";
import { stateRouter } from "./endpoints/state/router";
import { knowledgeRouter } from "./endpoints/knowledge/router";
import { syncRouter } from "./endpoints/sync/router";
import { memRouter } from "./endpoints/mem/router";
import { legalRouter } from "./endpoints/legal/router";
import { HealthCheck } from "./endpoints/health";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { DummyEndpoint } from "./endpoints/dummyEndpoint";
import { symphonyAuth } from "./middleware/auth";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  if (err instanceof ApiException) {
    // If it's a Chanfana ApiException, let Chanfana handle the response
    return c.json(
      { success: false, errors: err.buildResponse() },
      err.status as ContentfulStatusCode,
    );
  }

  console.error("Global error handler caught:", err); // Log the error if it's not known

  // For other errors, return a generic 500 response
  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: "Internal Server Error" }],
    },
    500,
  );
});

// Auth middleware on coordination endpoints
app.use("/agents/*", symphonyAuth);
app.use("/messages/*", symphonyAuth);
app.use("/state/*", symphonyAuth);
app.use("/knowledge/*", symphonyAuth);
app.use("/sync/*", symphonyAuth);
app.use("/mem/*", symphonyAuth);
app.use("/legal/*", symphonyAuth);

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "Symphony Coordination API",
      version: "3.0.0",
      description:
        "Symphony Creative Studio — unified coordination endpoint for multi-agent orchestration, asset management, and inter-agent messaging.",
    },
  },
});

// Health check (no auth required)
openapi.get("/health", HealthCheck);

// Register Tasks Sub router
openapi.route("/tasks", tasksRouter);

// Register Assets Sub router
openapi.route("/assets", assetsRouter);

// Symphony coordination routers (auth required)
openapi.route("/agents", agentsRouter);
openapi.route("/messages", messagesRouter);
openapi.route("/state", stateRouter);
openapi.route("/knowledge", knowledgeRouter);
openapi.route("/sync", syncRouter);
openapi.route("/mem", memRouter);
openapi.route("/legal", legalRouter);

// Register other endpoints
openapi.post("/dummy/:slug", DummyEndpoint);

// Export the Hono app
export default app;
