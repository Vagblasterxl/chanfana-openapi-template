import { Hono } from "hono";
import { fromHono } from "chanfana";
import { KnowledgeExtract } from "./knowledgeExtract";
import { KnowledgeQuery } from "./knowledgeQuery";
import { KnowledgeGraph } from "./knowledgeGraph";

export const knowledgeRouter = fromHono(new Hono());

knowledgeRouter.post("/extract", KnowledgeExtract);
knowledgeRouter.get("/query", KnowledgeQuery);
knowledgeRouter.get("/graph/:entity", KnowledgeGraph);
