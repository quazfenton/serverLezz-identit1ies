import React from 'react';

export type ConnectionRowProps = {
  id: string;
  name: string;
  strength: number; // 0-1
};

const ConnectionRow: React.FC<ConnectionRowProps> = ({ id, name, strength }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span>{name}</span>
      <span style={{ opacity: 0.7 }}>{(strength * 100).toFixed(0)}%</span>
    </div>
  );
};

export default ConnectionRow;


