import { D1UpdateEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AssetModel } from "./base";

export class AssetUpdate extends D1UpdateEndpoint<HandleArgs> {
  _meta = {
    model: AssetModel,
    fields: AssetModel.schema.pick({
      filename: true,
      asset_type: true,
      status: true,
      version: true,
      model: true,
      provider: true,
      mcp_server: true,
      prompt: true,
      local_path: true,
      tags: true,
      parent_assets: true,
      child_assets: true,
    }),
  };
}
