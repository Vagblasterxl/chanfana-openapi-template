import { D1DeleteEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { MemoryModel } from "../base";

export class MemoryDelete extends D1DeleteEndpoint<HandleArgs> {
  _meta = {
    model: MemoryModel,
  };
}
