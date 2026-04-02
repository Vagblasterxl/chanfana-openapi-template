import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { MemoryModel } from "../base";

export class MemoryList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: MemoryModel,
    searchFields: ["agent_id", "memory_type", "key", "content"],
    defaultOrderBy: "created_at",
    defaultOrderByDirection: "desc" as const,
  };
}
