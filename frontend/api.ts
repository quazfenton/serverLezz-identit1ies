import { Profile, ServiceListing } from "../shared/types";

const getSessionId = () => (typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null);

async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const sid = getSessionId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as any),
  };
  if (sid) headers['session-id'] = sid;

  const resp = await fetch(path, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${path} failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    return await apiFetch<Profile>("/api/profile/current");
  } catch {
    return null;
  }
}

export async function createProfile(body: Partial<Profile>): Promise<{ profile: Profile; sessionId: string }> {
  return apiFetch("/api/profile", { method: 'POST', body: JSON.stringify(body) });
}

export type ListingFilters = {
  nearLat?: number;
  nearLon?: number;
  radiusKm?: number;
  tags?: string[];
};

export async function getListings(filters: ListingFilters = {}): Promise<{ listings: ServiceListing[]; total: number }>
{
  const params = new URLSearchParams();
  if (filters.nearLat != null) params.set('nearLat', String(filters.nearLat));
  if (filters.nearLon != null) params.set('nearLon', String(filters.nearLon));
  if (filters.radiusKm != null) params.set('radiusKm', String(filters.radiusKm));
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  const qs = params.toString();
  return apiFetch(`/api/listings${qs ? `?${qs}` : ''}`);
}

export async function createListing(partial: Partial<ServiceListing>): Promise<ServiceListing> {
  return apiFetch('/api/listings', { method: 'POST', body: JSON.stringify(partial) });
}

export async function getMyListings(): Promise<{ listings: ServiceListing[]; total: number }> {
  return apiFetch('/api/listings/mine');
}

export async function updateListing(id: string, partial: Partial<ServiceListing>): Promise<ServiceListing> {
  return apiFetch(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(partial) });
}

export async function deleteListing(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/listings/${id}`, { method: 'DELETE' });
}

export async function getProfileById(id: string): Promise<Profile> {
  return apiFetch(`/api/profile/${id}`);
}

export async function getMatches(): Promise<{ matches: Array<{ profileB: string; matchScore: number; reason?: string }>; timestamp: string }>{
  // Server expects POST; empty body is acceptable for defaults
  return apiFetch('/api/matches', { method: 'POST', body: JSON.stringify({}) });
}

export async function getConnections(): Promise<{ connections: Array<{ profileId: string; strength: number }>; total: number }>{
  return apiFetch('/api/connections');
}


