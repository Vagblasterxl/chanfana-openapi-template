import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AgentModel } from "./base";

export class AgentList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: AgentModel,
  };

  searchFields = ["name", "type"];
  defaultOrderBy = "last_heartbeat DESC";
}
