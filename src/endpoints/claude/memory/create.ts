import { D1CreateEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { MemoryModel } from "../base";

export class MemoryCreate extends D1CreateEndpoint<HandleArgs> {
  _meta = {
    model: MemoryModel,
    fields: MemoryModel.schema.pick({
      agent_id: true,
      session_id: true,
      memory_type: true,
      key: true,
      content: true,
      priority: true,
      expires_at: true,
    }),
  };
}
