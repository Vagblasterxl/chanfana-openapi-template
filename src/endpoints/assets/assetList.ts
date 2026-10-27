import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AssetModel } from "./base";

export class AssetList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: AssetModel,
  };

  searchFields = ["filename", "asset_type", "status", "model", "prompt", "tags"];
  defaultOrderBy = "created_at DESC";
}
