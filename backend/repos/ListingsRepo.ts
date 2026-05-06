import { ServiceListing } from "../../shared/types";

export interface IListingsRepo {
  getById(id: string): Promise<ServiceListing | undefined>;
  save(listing: ServiceListing): Promise<void>;
  getAll(): Promise<ServiceListing[]>;
  byProvider(providerId: string): Promise<ServiceListing[]>;
}

export class ListingsRepo implements IListingsRepo {
  private store: Map<string, ServiceListing>;

  constructor(store: Map<string, ServiceListing> = new Map()) {
    this.store = store;
  }

  async getById(id: string): Promise<ServiceListing | undefined> {
    return this.store.get(id);
  }

  async save(listing: ServiceListing): Promise<void> {
    this.store.set(listing.id, listing);
  }

  async getAll(): Promise<ServiceListing[]> {
    return Array.from(this.store.values());
  }

  async byProvider(providerId: string): Promise<ServiceListing[]> {
    const all = await this.getAll();
    return all.filter((l) => l.providerId === providerId);
  }
}
