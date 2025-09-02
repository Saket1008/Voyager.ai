import React from 'react';

// Avatar component: can render assistant image or user initial
export default function Avatar({ role = 'assistant', size = 40, name = '' }) {
  const isUser = role === 'user';

  if (isUser) {
    const initial = (name || '').trim().charAt(0).toUpperCase() || 'U';
    return (
      <div style={{ height: size, width: size, borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1724' }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: Math.max(12, size / 2.6) }}>{initial}</span>
      </div>
    );
  }

  // assistant: use secondary logo image (circular crop) with minimal styling
  return (
    <div style={{ height: size, width: size, borderRadius: '9999px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <img src="/logo-secondary.png" alt="Voyager" style={{ width: '92%', height: '92%', objectFit: 'contain', borderRadius: '9999px' }} />
    </div>
  );
}
