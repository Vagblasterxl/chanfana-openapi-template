import { D1ReadEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AssetModel } from "./base";

export class AssetRead extends D1ReadEndpoint<HandleArgs> {
  _meta = {
    model: AssetModel,
  };
}
