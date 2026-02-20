import { D1DeleteEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AgentModel } from "./base";

export class AgentDelete extends D1DeleteEndpoint<HandleArgs> {
  _meta = {
    model: AgentModel,
  };
}
