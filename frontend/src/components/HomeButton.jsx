import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon } from 'lucide-react';

export default function HomeButton({ position = 'top-left' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const goHome = () => {
    if ((location?.pathname || '/') !== '/') navigate('/');
    try { window.dispatchEvent(new CustomEvent('voyager:goHome')); } catch {}
  };
  const posClass = (() => {
    if (position === 'top-right') return 'top-4 right-4';
    if (position === 'bottom-right') return 'bottom-4 right-4';
    if (position === 'bottom-left') return 'bottom-4 left-4';
    return 'top-4 left-4';
  })();

  return (
    <button
      onClick={goHome}
      className={`fixed ${posClass} z-50 h-10 w-10 grid place-items-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-white/10 backdrop-blur-md shadow-md`}
      aria-label="Home"
      title="Home"
    >
      <HomeIcon className="w-5 h-5" />
    </button>
  );
}
