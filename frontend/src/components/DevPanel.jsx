import React from 'react';
import { useDevSettings } from '../context/DevSettingsContext.jsx';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/apiBase';
import { toast } from '../lib/toast';

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
  const { currentUser } = useAuth();

  const handleResetAll = async () => {
    try {
      if (!window.confirm('This will delete your server data (itineraries, dreams, chats, feedback) for this account and clear local data. Continue?')) return;
      const token = currentUser ? await currentUser.getIdToken() : null;
      if (!token) { toast.error('Sign in required to reset server data'); return; }
      const res = await fetch(`${getApiBase()}/api/admin/reset-user`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const out = await res.json().catch(()=>({}));
      if (!res.ok || !out?.ok) {
        toast.error(out?.error || 'Failed to reset on server');
      } else {
        // Clear localStorage keys except dev settings
        try {
          const keep = new Set(['voyager_dev_settings_v1']);
          const toRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('voyager_') && !keep.has(k)) toRemove.push(k);
          }
          toRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}
        toast.success('Reset complete. Reloading…');
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (e) {
      toast.error(e?.message || 'Reset failed');
    }
  };

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
            <div className="pt-2 border-t border-white/10">
              <button onClick={handleResetAll} className="w-full px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs">
                Reset my data (server + local)
              </button>
              <div className="text-[10px] text-white/60 mt-1">Deletes itineraries, dreams, chats, and feedback for this account. Keeps dev settings.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
