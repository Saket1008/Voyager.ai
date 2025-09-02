import React from 'react';
import { User, Bot } from 'lucide-react';

export default function Avatar({ role = 'assistant', size = 40 }) {
  const isUser = role === 'user';
  const Icon = isUser ? User : Bot;
  const bgStyle = isUser ? { backgroundColor: '#374151' } : { background: 'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)' };
  return (
    <div style={{ height: size, width: size, borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', ...bgStyle }}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  );
}
