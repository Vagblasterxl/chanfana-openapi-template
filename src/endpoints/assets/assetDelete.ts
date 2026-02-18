import { D1DeleteEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AssetModel } from "./base";

export class AssetDelete extends D1DeleteEndpoint<HandleArgs> {
  _meta = {
    model: AssetModel,
  };
}
