import React from 'react';
import { useDevSettings } from '../context/DevSettingsContext.jsx';

const Toggle = ({ label, value, onChange, disabled = false }) => (
  <label className={`flex items-center justify-between gap-3 text-xs ${disabled ? 'opacity-60' : ''}`}>
    <span>{label}</span>
    <input
      type="checkbox"
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
  </label>
);

export default function DevPanel() {
  const { settings, setSetting, reset } = useDevSettings();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="fixed bottom-3 right-3 z-[10000] text-white">
      {/* Fab */}
      <button
        className="px-3 py-2 rounded-full bg-purple-600 hover:bg-purple-500 shadow"
        onClick={() => setOpen(v => !v)}
        title="Dev settings"
      >
        Dev
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-2 w-72 rounded-xl border border-white/20 bg-black/70 backdrop-blur-md p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Developer Settings</div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">✕</button>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 p-2">
              <Toggle label="Dev Mode (master)" value={settings.devMode} onChange={(v) => setSetting('devMode', v)} />
            </div>
            <div className={`rounded-lg border border-white/10 p-2 ${settings.devMode ? '' : 'opacity-60'}`}>
              <div className="text-[11px] text-white/70 mb-1">Feature toggles</div>
              <div className="space-y-2">
                <Toggle label="Space background" value={settings.showSpaceBg} onChange={(v) => setSetting('showSpaceBg', v)} disabled={!settings.devMode} />
                <Toggle label="Onboarding flow" value={settings.showOnboarding} onChange={(v) => setSetting('showOnboarding', v)} disabled={!settings.devMode} />
                <Toggle label="Use Gemini API (real)" value={settings.useGeminiApi} onChange={(v) => setSetting('useGeminiApi', v)} disabled={!settings.devMode} />
                <Toggle label="Show Auto Chat button" value={settings.showAutoChatButton} onChange={(v) => setSetting('showAutoChatButton', v)} disabled={!settings.devMode} />
              </div>
            </div>
            <div className={`rounded-lg border border-white/10 p-2 ${settings.devMode ? '' : 'opacity-60'}`}>
              <div className="text-[11px] text-white/70 mb-1">Landing & animation</div>
              <div className="space-y-2">
                <Toggle label="Splash loader" value={settings.showSplashLoader} onChange={(v) => setSetting('showSplashLoader', v)} disabled={!settings.devMode} />
                <Toggle label="Landing Begin screen" value={settings.showLandingStart} onChange={(v) => setSetting('showLandingStart', v)} disabled={!settings.devMode} />
                <Toggle label="Wormhole animation" value={settings.enableWormhole} onChange={(v) => setSetting('enableWormhole', v)} disabled={!settings.devMode} />
                <Toggle label="Start directly in chat" value={settings.startAtChat} onChange={(v) => setSetting('startAtChat', v)} disabled={!settings.devMode} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <button onClick={reset} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10">Reset</button>
              <span className="text-white/50">Local only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
