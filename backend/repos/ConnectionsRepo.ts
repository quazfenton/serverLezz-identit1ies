import { Connection } from "../../shared/types";

export interface IConnectionsRepo {
  create(connection: Connection): Promise<Connection>;
  getByProfile(profileId: string): Promise<Connection[]>;
  getById(id: string): Promise<Connection | undefined>;
}

export class ConnectionsRepo implements IConnectionsRepo {
  private store: Map<string, Connection>;

  constructor(store: Map<string, Connection> = new Map()) {
    this.store = store;
  }

  async create(connection: Connection): Promise<Connection> {
    this.store.set(connection.id, connection);
    return connection;
  }

  async getByProfile(profileId: string): Promise<Connection[]> {
    return Array.from(this.store.values()).filter(
      (c) =>
        c.profileA === profileId ||
        c.profileB === profileId ||
        c.fromProfileId === profileId ||
        c.toProfileId === profileId
    );
  }

  async getById(id: string): Promise<Connection | undefined> {
    return this.store.get(id);
  }
}
