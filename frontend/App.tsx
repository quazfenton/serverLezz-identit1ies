import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Profile, ServiceListing } from '../shared/types';

const App: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<ServiceListing[]>([]);

  useEffect(() => {
    // Initialize profile and fetch listings
    const initProfile = async () => {
      const profileData = await fetch('/api/profile').then(res => res.json());
      setProfile(profileData);
      
      const listingsData = await fetch('/api/listings').then(res => res.json());
      setListings(listingsData);
    };

    initProfile();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Serverless Marketplace</h1>
        {profile && (
          <div className="profile">
            <span>{profile.name}</span>
            <img src={profile.avatar} alt={profile.name} />
          </div>
        )}
      </header>
      
      <main>
        <section className="listings">
          {listings.map(listing => (
            <div key={listing.id} className="listing">
              <h3>{listing.title}</h3>
              <p>{listing.description}</p>
              <span>{listing.price}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);