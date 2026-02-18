import { z } from "zod";

export const asset = z.object({
  id: z.string(),
  filename: z.string(),
  asset_type: z.enum(["image", "video", "music", "speech", "composition"]),
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
  version: z.number().int().default(1),
  model: z.string().nullable(),
  provider: z.string().nullable(),
  mcp_server: z.string().nullable(),
  prompt: z.string().nullable(),
  local_path: z.string(),
  tags: z.string().nullable(),
  parent_assets: z.string().nullable(),
  child_assets: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const AssetModel = {
  tableName: "assets",
  primaryKeys: ["id"],
  schema: asset,
  serializer: (obj: Record<string, string | number | boolean | null>) => {
    return {
      ...obj,
    };
  },
  serializerObject: asset,
};
