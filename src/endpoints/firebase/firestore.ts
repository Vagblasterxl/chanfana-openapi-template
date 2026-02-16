import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../../firebase/client";

interface FirebaseEnv {
  GOOGLE_SERVICE_ACCOUNT: string;
  FIREBASE_PROJECT_ID: string;
}

function getFirebaseEnv(c: AppContext) {
  const env = c.env as unknown as FirebaseEnv;
  if (!env.GOOGLE_SERVICE_ACCOUNT) {
    return { error: "GOOGLE_SERVICE_ACCOUNT secret not set" };
  }
  if (!env.FIREBASE_PROJECT_ID) {
    return { error: "FIREBASE_PROJECT_ID var not set in wrangler config" };
  }
  return { saJson: env.GOOGLE_SERVICE_ACCOUNT, projectId: env.FIREBASE_PROJECT_ID };
}

// GET /firebase/firestore/:collection — List documents
export class FirestoreList extends OpenAPIRoute {
  public schema = {
    tags: ["Firebase Firestore"],
    summary: "List documents in a Firestore collection",
    operationId: "firebase-firestore-list",
    request: {
      params: z.object({
        collection: z.string().describe("Firestore collection name"),
      }),
      query: z.object({
        pageSize: z.string().optional().describe("Max documents per page"),
        pageToken: z.string().optional().describe("Pagination token"),
      }),
    },
    responses: {
      "200": {
        description: "List of documents",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const env = getFirebaseEnv(c);
    if ("error" in env) return c.json({ success: false, error: env.error }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await listDocuments(
      env.saJson,
      env.projectId,
      data.params.collection,
      data.query.pageSize ? parseInt(data.query.pageSize) : undefined,
      data.query.pageToken || undefined,
    );

    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);
    return { success: true, result: res.data };
  }
}

// GET /firebase/firestore/:collection/:documentId — Get a document
export class FirestoreGet extends OpenAPIRoute {
  public schema = {
    tags: ["Firebase Firestore"],
    summary: "Get a Firestore document by ID",
    operationId: "firebase-firestore-get",
    request: {
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "Document data",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const env = getFirebaseEnv(c);
    if ("error" in env) return c.json({ success: false, error: env.error }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await getDocument(
      env.saJson,
      env.projectId,
      `${data.params.collection}/${data.params.documentId}`,
    );

    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);
    return { success: true, result: res.data };
  }
}

// POST /firebase/firestore/:collection — Create a document
export class FirestoreCreate extends OpenAPIRoute {
  public schema = {
    tags: ["Firebase Firestore"],
    summary: "Create a new Firestore document",
    operationId: "firebase-firestore-create",
    request: {
      params: z.object({
        collection: z.string(),
      }),
      body: contentJson(
        z.object({
          documentId: z.string().optional().describe("Optional custom document ID"),
          fields: z.record(z.any()).describe("Document fields as key-value pairs"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Created document",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const env = getFirebaseEnv(c);
    if ("error" in env) return c.json({ success: false, error: env.error }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await createDocument(
      env.saJson,
      env.projectId,
      data.params.collection,
      data.body.fields,
      data.body.documentId,
    );

    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);
    return { success: true, result: res.data };
  }
}

// PATCH /firebase/firestore/:collection/:documentId — Update a document
export class FirestoreUpdate extends OpenAPIRoute {
  public schema = {
    tags: ["Firebase Firestore"],
    summary: "Update a Firestore document",
    operationId: "firebase-firestore-update",
    request: {
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
      body: contentJson(
        z.object({
          fields: z.record(z.any()).describe("Fields to update"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Updated document",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const env = getFirebaseEnv(c);
    if ("error" in env) return c.json({ success: false, error: env.error }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await updateDocument(
      env.saJson,
      env.projectId,
      `${data.params.collection}/${data.params.documentId}`,
      data.body.fields,
    );

    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);
    return { success: true, result: res.data };
  }
}

// DELETE /firebase/firestore/:collection/:documentId — Delete a document
export class FirestoreDelete extends OpenAPIRoute {
  public schema = {
    tags: ["Firebase Firestore"],
    summary: "Delete a Firestore document",
    operationId: "firebase-firestore-delete",
    request: {
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "Deletion result",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const env = getFirebaseEnv(c);
    if ("error" in env) return c.json({ success: false, error: env.error }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await deleteDocument(
      env.saJson,
      env.projectId,
      `${data.params.collection}/${data.params.documentId}`,
    );

    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);
    return { success: true, result: { message: "Document deleted" } };
  }
}
