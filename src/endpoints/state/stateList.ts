import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { StateModel } from "./base";

export class StateList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: StateModel,
  };

  searchFields = ["state_type"];
  defaultOrderBy = "id ASC";
}
