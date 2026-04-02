import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { CommsModel } from "../base";

export class CommsList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: CommsModel,
    searchFields: ["direction", "from_entity", "to_entity", "status"],
    defaultOrderBy: "created_at",
    defaultOrderByDirection: "desc" as const,
  };
}
