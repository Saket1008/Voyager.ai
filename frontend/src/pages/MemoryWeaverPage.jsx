import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Image as ImageIcon, Download, Home, ArrowLeft, Copy as CopyIcon, Printer, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/apiBase';
import { toast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';

// Simple PDF export using print-to-PDF approach
function downloadMarkdownAsPdf(markdownHtml) {
  try {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Popup blocked');
    w.document.write(`<!DOCTYPE html><html><head><title>Travel Journal</title><style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111;}
      .page{max-width:800px;margin:24px auto;padding:0 16px}
      img{max-width:100%; border-radius:10px}
      pre{white-space:pre-wrap;}
    </style></head><body><div class="page">${markdownHtml}</div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  } catch (e) {
    toast.error('Unable to open print dialog. Please allow popups.');
  }
}

export default function MemoryWeaverPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [journalMd, setJournalMd] = useState('');

  // Load journeys from API
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!currentUser) { setLoading(false); return; }
        const token = await currentUser.getIdToken();
        const res = await fetch(`${getApiBase()}/api/journeys`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load journeys');
        const data = await res.json();
        // Normalize a few expected fields
        const list = Array.isArray(data?.items || data?.journeys || data) ? (data.items || data.journeys || data) : [];
        if (mounted) setJourneys(list);
      } catch (e) {
        console.error('[MemoryWeaver] journeys fetch error:', e);
        toast.error('Could not load journeys.');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [currentUser]);

  const hasPhotos = useMemo(() => Array.isArray(active?.photos) && active.photos.length > 0, [active]);

  const handleGenerate = async () => {
    if (!active) { toast.warn('Please select a completed journey first.'); return; }
    setGenerating(true);
    try {
      const token = await currentUser.getIdToken();
      const payload = { journeyId: active.id };
      const res = await fetch(`${getApiBase()}/api/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate journal');
      const md = String(data?.markdown || data?.content || '').trim();
      if (!md) throw new Error('AI returned empty content');
      setJournalMd(md);
      toast.success('Your travel journal is ready!');
    } catch (e) {
      console.error('[MemoryWeaver] generate error:', e);
      toast.error(e?.message || 'Failed to generate journal');
    } finally { setGenerating(false); }
  };

  const handleCopyMarkdown = () => {
    try {
      if (!journalMd) return;
      navigator.clipboard.writeText(journalMd);
      toast.success('Markdown copied to clipboard');
    } catch { toast.error('Copy failed'); }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" title="Back">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20" title="Home">
              <Home className="w-4 h-4" /> Home
            </button>
          </div>
          <div className="text-right">
            <div className="text-xl md:text-2xl font-semibold flex items-center gap-2">
              <span>📖</span>
              <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">Memory Weaver</span>
            </div>
            <div className="text-xs text-white/70">Relive your journey with an AI-crafted travelogue.</div>
          </div>
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Left: Journeys list */}
          <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="text-sm text-white/80 mb-2">Select Completed Journey</div>
            <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-auto pr-1">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
                ))
              ) : journeys.length === 0 ? (
                <div className="text-white/60 text-sm">No journeys found. Generate an itinerary first.</div>
              ) : (
                journeys.map((j) => {
                  const created = j.createdAt?.toDate ? j.createdAt.toDate() : (j.createdAt ? new Date(j.createdAt) : (j.date ? new Date(j.date) : null));
                  const dateStr = created ? created.toLocaleDateString() : '';
                  const destinations = Array.isArray(j.locations) ? j.locations.join(', ') : (j.region || '');
                  const isActive = active?.id === j.id;
                  return (
                    <motion.button
                      key={j.id}
                      onClick={() => setActive(j)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`text-left rounded-xl border p-3 transition ${isActive ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_10px_30px_rgba(25,195,125,0.25)]' : 'border-white/10 bg-white/5'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center gap-2"><Book className="w-4 h-4" />{j.title || 'Journey'}</div>
                          <div className="text-xs text-white/70 truncate">{dateStr}</div>
                          <div className="text-xs text-white/60 truncate">{destinations}</div>
                        </div>
                        {Array.isArray(j.photos) && j.photos.length > 0 && (
                          <div className="text-[11px] text-white/70 inline-flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> {j.photos.length}</div>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Journal panel */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md min-h-[50vh]">
            {/* Header actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-white/70">Selected Journey</div>
                <div className="text-lg font-semibold truncate">{active ? (active.title || 'Journey') : 'None selected'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopyMarkdown} disabled={!journalMd} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50" title="Copy Markdown">
                  <CopyIcon className="w-4 h-4" /> Copy
                </button>
                <button
                  onClick={() => {
                    try {
                      const mdRoot = document.querySelector('.prose');
                      const html = mdRoot ? mdRoot.innerHTML : '';
                      if (!html) throw new Error('Nothing to print');
                      downloadMarkdownAsPdf(html);
                    } catch (e) { toast.error('PDF export failed'); }
                  }}
                  disabled={!journalMd}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button onClick={handleGenerate} disabled={!active || generating} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400 disabled:opacity-50" title="Generate with AI">
                  <Wand2 className="w-4 h-4" /> {generating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>

            {/* Photos grid */}
            {active && Array.isArray(active.photos) && active.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {active.photos.slice(0, 6).map((src, idx) => (
                  <img key={idx} src={src} alt={`Journey photo ${idx+1}`} className="rounded-lg object-cover w-full h-24" />
                ))}
              </div>
            )}

            {/* Journal */}
            <div className="mt-4">
              {!journalMd ? (
                <div className="text-sm text-white/70">
                  {active ? 'Click Generate to craft your travel journal.' : 'Select a journey from the left to begin.'}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{journalMd}</ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
