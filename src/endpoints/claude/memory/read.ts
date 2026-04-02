import { D1ReadEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { MemoryModel } from "../base";

export class MemoryRead extends D1ReadEndpoint<HandleArgs> {
  _meta = {
    model: MemoryModel,
  };
}
