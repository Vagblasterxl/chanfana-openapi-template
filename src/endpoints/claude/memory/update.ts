import { D1UpdateEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { MemoryModel } from "../base";

export class MemoryUpdate extends D1UpdateEndpoint<HandleArgs> {
  _meta = {
    model: MemoryModel,
    fields: MemoryModel.schema.pick({
      content: true,
      priority: true,
      expires_at: true,
      memory_type: true,
      key: true,
    }),
  };
}
