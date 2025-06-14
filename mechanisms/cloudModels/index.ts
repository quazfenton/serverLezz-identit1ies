import { Profile, ServiceListing } from '../../shared/types';

export interface CloudModel {
  id: string;
  name: string;
  endpoint: string;
  lastUpdated: Date;
}

export const processProfileThroughModel = async (
  profile: Profile,
  model: CloudModel
): Promise<Profile> => {
  const response = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Model processing failed: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    ...profile,
    resources: {
      ...profile.resources,
      needs: result.updatedNeeds || profile.resources.needs,
      skills: result.updatedSkills || profile.resources.skills,
    },
    weight: result.newWeight || profile.weight,
  };
};

export const processListingThroughModel = async (
  listing: ServiceListing,
  model: CloudModel
): Promise<ServiceListing> => {
  const response = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      listing,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Model processing failed: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    ...listing,
    tags: result.updatedTags || listing.tags,
    price: result.updatedPrice || listing.price,
  };
};