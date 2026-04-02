import { D1ListEndpoint, D1CreateEndpoint, D1ReadEndpoint, D1UpdateEndpoint, D1DeleteEndpoint } from "chanfana";
import { HandleArgs } from "../../../types";
import { WorkerRegistryModel } from "../base";

export class RegistryList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: WorkerRegistryModel,
    searchFields: ["name", "account", "status", "description"],
    defaultOrderBy: "name",
    defaultOrderByDirection: "asc" as const,
  };
}

export class RegistryCreate extends D1CreateEndpoint<HandleArgs> {
  _meta = {
    model: WorkerRegistryModel,
    fields: WorkerRegistryModel.schema.pick({
      name: true,
      url: true,
      auth_type: true,
      auth_header: true,
      auth_token: true,
      account: true,
      description: true,
      status: true,
    }),
  };
}

export class RegistryRead extends D1ReadEndpoint<HandleArgs> {
  _meta = {
    model: WorkerRegistryModel,
  };
}

export class RegistryUpdate extends D1UpdateEndpoint<HandleArgs> {
  _meta = {
    model: WorkerRegistryModel,
    fields: WorkerRegistryModel.schema.pick({
      url: true,
      auth_type: true,
      auth_header: true,
      auth_token: true,
      account: true,
      description: true,
      status: true,
    }),
  };
}

export class RegistryDelete extends D1DeleteEndpoint<HandleArgs> {
  _meta = {
    model: WorkerRegistryModel,
  };
}
