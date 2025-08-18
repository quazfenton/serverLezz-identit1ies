import React from 'react';
import { ServiceListing } from "../../shared/types";

export type ListingCardProps = {
  listing: ServiceListing;
  canConnect?: boolean;
  onConnect?: (providerId: string) => void;
  onEdit?: (listing: ServiceListing) => void;
  onDeactivate?: (listing: ServiceListing) => void;
};

const ListingCard: React.FC<ListingCardProps> = ({ listing, canConnect, onConnect, onEdit, onDeactivate }) => {
  return (
    <div className="listing-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{listing.title}</strong>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.7, fontSize: 12 }}>{listing.type}</span>
          {canConnect && onConnect && (
            <button className="mode-button" onClick={() => onConnect(listing.providerId)}>Connect</button>
          )}
          {onEdit && (
            <button className="mode-button" onClick={() => onEdit(listing)}>Edit</button>
          )}
          {onDeactivate && (
            <button className="mode-button" onClick={() => onDeactivate(listing)}>Deactivate</button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{listing.description}</div>
      <div className="listing-tags" style={{ marginTop: 6 }}>
        {listing.tags.slice(0, 6).map((t) => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
    </div>
  );
};

export default ListingCard;


