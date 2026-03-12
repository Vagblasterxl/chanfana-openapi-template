import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { tasksRouter } from "./endpoints/tasks/router";
import { googleRouter } from "./endpoints/google/router";
import { githubRouter } from "./endpoints/github/router";
import { firebaseRouter } from "./endpoints/firebase/router";
import { oracleRouter } from "./endpoints/oracle/router";
import { ContentfulStatusCode } from "hono/utils/http-status";

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

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "Vagblasterxl Command Center",
      version: "3.0.0",
      description:
        "Unified control plane — Cloudflare Workers + Google + Firebase + GitHub + Oracle (inter-agent comms). Hit /oracle/setup first, then /oracle/send to start talking.",
    },
  },
});

// D1-backed task management
openapi.route("/tasks", tasksRouter);

// Google APIs: Sheets, Drive, Calendar, Gmail, status, D1-to-Sheet sync
openapi.route("/google", googleRouter);

// GitHub: repos, discover (vending machine), deploy (one-click fork)
openapi.route("/github", githubRouter);

// Firebase: Firestore CRUD
openapi.route("/firebase", firebaseRouter);

// Oracle: Inter-agent communication bus
openapi.route("/oracle", oracleRouter);

// Export the Hono app
export default app;
