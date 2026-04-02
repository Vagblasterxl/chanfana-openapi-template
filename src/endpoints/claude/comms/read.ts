import { D1ReadEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { CommsModel } from "../base";

export class CommsRead extends D1ReadEndpoint<HandleArgs> {
  _meta = {
    model: CommsModel,
  };
}
