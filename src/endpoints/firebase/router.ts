import { Hono } from "hono";
import { fromHono } from "chanfana";
import {
  FirestoreList,
  FirestoreGet,
  FirestoreCreate,
  FirestoreUpdate,
  FirestoreDelete,
} from "./firestore";

export const firebaseRouter = fromHono(new Hono());

// --- Firestore CRUD ---
firebaseRouter.get("/firestore/:collection", FirestoreList);
firebaseRouter.get("/firestore/:collection/:documentId", FirestoreGet);
firebaseRouter.post("/firestore/:collection", FirestoreCreate);
firebaseRouter.put("/firestore/:collection/:documentId", FirestoreUpdate);
firebaseRouter.delete("/firestore/:collection/:documentId", FirestoreDelete);
