import { Profile } from "../../shared/types";

export interface IProfilesRepo {
  getById(id: string): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
  getAll(): Promise<Profile[]>;
}

export class ProfilesRepo implements IProfilesRepo {
  private store: Map<string, Profile>;

  constructor(store: Map<string, Profile> = new Map()) {
    this.store = store;
  }

  async getById(id: string): Promise<Profile | undefined> {
    return this.store.get(id);
  }

  async save(profile: Profile): Promise<void> {
    this.store.set(profile.id, profile);
  }

  async getAll(): Promise<Profile[]> {
    return Array.from(this.store.values());
  }
}
