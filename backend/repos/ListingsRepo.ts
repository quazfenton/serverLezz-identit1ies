import { ServiceListing } from "../../shared/types";

export interface IListingsRepo {
  getById(id: string): ServiceListing | undefined;
  save(listing: ServiceListing): void;
  getAll(): ServiceListing[];
  byProvider(providerId: string): ServiceListing[];
}

export class ListingsRepo implements IListingsRepo {
  private store: Map<string, ServiceListing>;

  constructor(store: Map<string, ServiceListing>) {
    this.store = store;
  }

  getById(id: string): ServiceListing | undefined {
    return this.store.get(id);
  }

  save(listing: ServiceListing): void {
    this.store.set(listing.id, listing);
  }

  getAll(): ServiceListing[] {
    return Array.from(this.store.values());
  }

  byProvider(providerId: string): ServiceListing[] {
    return this.getAll().filter((l) => l.providerId === providerId);
  }
}


