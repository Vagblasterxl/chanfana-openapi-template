import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { MessageModel } from "./base";

export class MessageList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: MessageModel,
  };

  searchFields = ["sender", "recipient", "message_type"];
  defaultOrderBy = "created_at DESC";
}
