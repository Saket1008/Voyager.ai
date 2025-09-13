import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LS_KEY = 'voyager_dev_settings_v1';

const defaultSettings = {
  devMode: false,
  showSpaceBg: true,
  showOnboarding: true,
  useGeminiApi: true,
  showAutoChatButton: true,
  // Landing/animation controls
  showLandingStart: true,      // show the landing screen with Begin button
  showSplashLoader: true,      // show the initial loader before landing
  enableWormhole: true,        // play wormhole animation on Begin
  startAtChat: false,          // jump directly into chat on load
};

const DevSettingsContext = createContext({
  settings: defaultSettings,
  setSetting: () => {},
  reset: () => {},
});

export function DevSettingsProvider({ children }) {
  // Lazy initializer: read once before first render to avoid flicker
  const [settings, setSettings] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
      if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {}
    return defaultSettings;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const api = useMemo(() => ({
    settings,
    setSetting: (key, value) => {
      setSettings(prev => ({ ...prev, [key]: value }));
    },
    reset: () => setSettings(defaultSettings),
  }), [settings]);

  return (
    <DevSettingsContext.Provider value={api}>
      {children}
    </DevSettingsContext.Provider>
  );
}

export function useDevSettings() {
  return useContext(DevSettingsContext);
}
