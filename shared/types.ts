export interface Profile {
  id: string;
  name: string;
  avatar: string;
  location: {
    latitude: number;
    longitude: number;
  };
  resources: {
    goods: string[];
    skills: string[];
    needs: string[];
  };
  weight: number;
  lastUpdated: Date;
}

export interface ServiceListing {
  id: string;
  title: string;
  description: string;
  price: string;
  providerId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphNode {
  profile: Profile;
  connections: string[];
  weight: number;
  lastInteraction: Date;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  lastUsed: Date;
}