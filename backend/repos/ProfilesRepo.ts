import { Profile } from "../../shared/types";

export interface IProfilesRepo {
  getById(id: string): Profile | undefined;
  save(profile: Profile): void;
  getAll(): Profile[];
}

export class ProfilesRepo implements IProfilesRepo {
  private store: Map<string, Profile>;

  constructor(store: Map<string, Profile>) {
    this.store = store;
  }

  getById(id: string): Profile | undefined {
    return this.store.get(id);
  }

  save(profile: Profile): void {
    this.store.set(profile.id, profile);
  }

  getAll(): Profile[] {
    return Array.from(this.store.values());
  }
}


