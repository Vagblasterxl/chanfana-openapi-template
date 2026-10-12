import { Hono } from "hono";
import { fromHono } from "chanfana";
import { AssetList } from "./assetList";
import { AssetCreate } from "./assetCreate";
import { AssetRead } from "./assetRead";
import { AssetUpdate } from "./assetUpdate";
import { AssetDelete } from "./assetDelete";
import { AssetReview } from "./assetReview";

export const assetsRouter = fromHono(new Hono());

assetsRouter.get("/", AssetList);
assetsRouter.post("/", AssetCreate);
assetsRouter.get("/:id", AssetRead);
assetsRouter.put("/:id", AssetUpdate);
assetsRouter.delete("/:id", AssetDelete);
assetsRouter.post("/:id/review", AssetReview);
