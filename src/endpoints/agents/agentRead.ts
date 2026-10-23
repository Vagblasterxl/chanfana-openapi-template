import { D1ReadEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { AgentModel } from "./base";

export class AgentRead extends D1ReadEndpoint<HandleArgs> {
  _meta = {
    model: AgentModel,
  };
}
