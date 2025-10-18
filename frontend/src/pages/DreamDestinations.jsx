import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, PiggyBank, Users, Plus, CalendarDays, Home, Rocket, Copy, Search, SlidersHorizontal, X, Pencil, FilePlus2, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, isFirebaseReady, getFirebaseIdToken } from '../lib/firebaseClient';
import { toast } from '../lib/toast';
import { getApiBase } from '../lib/apiBase';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { capitalizeLocationSegments, titleCaseLocationText } from '../lib/format';

// Presentational card component (top-level to avoid remounts)
function DreamCard({ trip, canDelete, onDelete, onAddSavings, onEdit, onDuplicate, onShare }) {
  const sym = trip.currency === 'INR' ? '₹' : '$';
  const total = Number(trip.budgetTotal || 0);
  const saved = Number(trip.savedAmount || 0);
  const pct = total > 0 ? Math.min(100, Math.round((saved / total) * 100)) : 0;
  return (
    <motion.div whileHover={{ y: -3 }} className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-white hover:border-emerald-300/40 transition-all hover:shadow-[0_10px_30px_rgba(25,195,125,0.25)]">
      {/* subtle gradient edge */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl [mask:linear-gradient(#000,transparent_70%)]">
        <div className="absolute inset-[1px] rounded-[15px] bg-gradient-to-br from-emerald-300/10 via-cyan-300/10 to-sky-300/10" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="w-4 h-4 text-emerald-300" />
            <span>{trip.destination}</span>
            {trip.collaborative ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                <Users className="w-3.5 h-3.5" /> Collaborative
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-white/70 flex items-center gap-2">
            <span>{trip.targetDate ? `Target: ${trip.targetDate}` : 'No target date'}</span>
            {(trip.days || trip.travelers) ? (
              <span className="inline-flex items-center gap-2 text-white/60">
                {trip.days ? <span>{trip.days} days</span> : null}
                {trip.travelers ? <span>• {trip.travelers} travelers</span> : null}
              </span>
            ) : null}
          </div>
          {trip.collaborative && trip.shareId && (
            <div className="mt-1 text-[11px] text-white/60">ID: <span className="font-mono">{trip.shareId}</span></div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-white/70">Budget</div>
          <div className="text-base font-semibold">{sym} {total.toLocaleString()}</div>
          {trip.travelers ? (
            <div className="text-[11px] text-white/60">(~ {sym} {(total / Math.max(1, Number(trip.travelers))).toLocaleString()} / traveler)</div>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span className="inline-flex items-center gap-1">
            <PiggyBank className="w-3.5 h-3.5" />
            Saved: {sym} {saved.toLocaleString()}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {trip.collaborative && Array.isArray(trip.contributors) && trip.contributors.length > 0 && (
        <div className="mt-3 text-xs text-white/80">
          <div className="mb-1 flex items-center gap-1 text-white/70"><Users className="w-3.5 h-3.5" /> Contributors</div>
          <div className="flex flex-wrap gap-2">
            {trip.contributors.map((c, i) => (
              <span key={i} className="rounded-full bg-white/10 px-2 py-0.5">{c.name}: {c.share}%</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-sm text-red-200"
          disabled={!canDelete}
          title={!canDelete ? 'Only owner can delete' : 'Delete'}
        >
          Delete
        </button>
        <button
          onClick={() => {
            const val = prompt('Add amount to savings', '1000');
            if (val != null) onAddSavings(val);
          }}
          className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-sm"
        >
          + Add Savings
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1.5 text-sm" title="Edit">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={onDuplicate} className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1.5 text-sm" title="Duplicate">
            <FilePlus2 className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button onClick={onShare} className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1.5 text-sm" title="Share">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Local fallback helpers when Firebase isn't configured or user not signed in
function useLocalDreams(uid) {
  const key = `voyager:dreams:v1:${uid || 'anon'}`;
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  };
  const write = (arr) => { try { localStorage.setItem(key, JSON.stringify(arr)); } catch {} };
  return { key, read, write };
}

export default function DreamDestinations() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // List and UI state
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all | solo | collab
  const [sortKey, setSortKey] = useState('recent'); // recent | savedPct | budget
  const [uniqueDestChips, setUniqueDestChips] = useState([]);

  // Suggestions (destination and search)
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showDestSug, setShowDestSug] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSug, setShowSearchSug] = useState(false);
  const searchRef = useRef(null);
  const destSugRef = useRef(null);

  // Form state
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState('INR'); // forced to INR
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState('');
  const [travelers, setTravelers] = useState('1');
  const [estimating, setEstimating] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [collaborative, setCollaborative] = useState(false); // only for create mode
  const [collabMode, setCollabMode] = useState('create'); // 'create' | 'join'
  const [shareId, setShareId] = useState('');
  const [joinId, setJoinId] = useState('');
  const destInputRef = useRef(null);

  const uid = currentUser?.uid || 'anon';
  const local = useLocalDreams(uid);
  const usingFirestore = Boolean(db && isFirebaseReady && currentUser?.uid);

  const normalizeTrips = (arr = []) => (
    arr.map(t => ({
      id: t.id,
      destination: t.destination || '',
      currency: t.currency || 'INR',
      budgetTotal: typeof t.budgetTotal === 'number' ? t.budgetTotal : (typeof t.budget === 'number' ? t.budget : 0),
      savedAmount: typeof t.savedAmount === 'number' ? t.savedAmount : (typeof t.saved === 'number' ? t.saved : 0),
      targetDate: t.targetDate || null,
      collaborative: !!t.collaborative,
      contributors: Array.isArray(t.contributors) ? t.contributors : [],
      ownerUid: t.ownerUid,
      members: Array.isArray(t.members) ? t.members : [],
      shareId: t.shareId,
      createdAt: t.createdAt || null,
    }))
  );

  // Load dreams from API (includes collaborations) when authed; else fallback to local
  const fetchDreams = useCallback(async () => {
    setLoading(true);
    try {
      if (usingFirestore) {
        const token = await getFirebaseIdToken();
        if (token) {
          const res = await fetch(`${getApiBase()}/api/dreams`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error('list fail');
          const data = await res.json();
          const arr = Array.isArray(data?.trips) ? data.trips : [];
          setItems(normalizeTrips(arr));
          setLoading(false);
          return;
        }
      }
      // Local fallback
      const arr = local.read();
      setItems(Array.isArray(arr) ? normalizeTrips(arr) : []);
    } catch {
      const arr = local.read();
      setItems(Array.isArray(arr) ? normalizeTrips(arr) : []);
    } finally {
      setLoading(false);
    }
  }, [usingFirestore, currentUser?.uid]);

  useEffect(() => { fetchDreams(); }, [fetchDreams]);

  // Build quick chips from existing destinations
  useEffect(() => {
    const set = new Set();
    items.forEach(it => { const d = (it.destination || '').trim(); if (d) set.add(d); });
    const list = Array.from(set).slice(0, 6);
    setUniqueDestChips(list);
  }, [items]);

  const filteredItems = useMemo(() => {
    let arr = Array.isArray(items) ? [...items] : [];
    // Filter by collaborative
    if (filterMode === 'solo') arr = arr.filter(t => !t.collaborative);
    if (filterMode === 'collab') arr = arr.filter(t => !!t.collaborative);
    // Search by destination
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter(t => (t.destination || '').toLowerCase().includes(q));
    // Sort
    if (sortKey === 'savedPct') {
      arr.sort((a,b) => ((b.savedAmount||0)/(b.budgetTotal||1)) - ((a.savedAmount||0)/(a.budgetTotal||1)));
    } else if (sortKey === 'budget') {
      arr.sort((a,b) => (b.budgetTotal||0) - (a.budgetTotal||0));
    } else if (sortKey === 'targetDate') {
      arr.sort((a,b) => new Date(a.targetDate || '9999-12-31') - new Date(b.targetDate || '9999-12-31'));
    } else {
      // recent by createdAt descending if present, else keep
      arr.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return arr;
  }, [items, filterMode, search, sortKey]);

  const parseAmount = (s) => {
    const n = Number(String(s).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const resetForm = () => {
    setDestination('');
    setBudget('');
    setDays('');
    setTravelers('1');
    setTargetDate('');
    setCollaborative(false);
    setCollabMode('create');
    setShareId('');
    setJoinId('');
    setMode(null);
  };

  const handleSave = async () => {
    if (!destination.trim()) return;
    if (collaborative && collabMode === 'join') return; // In join mode, use Join button instead
    const total = parseAmount(budget);
    const payload = {
      destination: destination.trim(),
      currency,
      budgetTotal: total,
      savedAmount: 0,
      targetDate: targetDate || null,
      collaborative: !!collaborative,
      contributors: collaborative ? [
        { name: 'You', share: 60 },
        { name: 'Alex', share: 40 },
      ] : [],
      shareId: collaborative && collabMode === 'create' && shareId ? shareId : undefined,
      createdAt: serverTimestamp?.() || new Date(),
      days: Number(days) || undefined,
      travelers: Number(travelers) || undefined,
    };
    setSaving(true);
    try {
      if (usingFirestore) {
        // Prefer API so server sets ownerUid/members/etc
        const token = await getFirebaseIdToken();
        if (token) {
          const res = await fetch(`${getApiBase()}/api/dreams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              destination: payload.destination,
              // Only send budget if user entered it; server will estimate when missing
              ...(total > 0 ? { budget: payload.budgetTotal } : {}),
              days: Number(days) || undefined,
              travelers: Number(travelers) || undefined,
              targetDate: payload.targetDate,
              saved: 0,
              collaborative: payload.collaborative,
              members: undefined,
              currency,
              shareId: collabMode === 'create' ? (shareId || undefined) : undefined,
            }),
          });
          if (!res.ok) throw new Error('create fail');
          await fetchDreams();
        } else {
          const tripsRef = collection(db, 'dreams', currentUser.uid, 'trips');
          // Local Firestore (unlikely); ensure a budget exists
          await addDoc(tripsRef, { ...payload, budgetTotal: total > 0 ? total : 25000 });
          await fetchDreams();
        }
      } else {
        const arr = local.read();
        const item = { id: `loc-${Date.now()}`, ...payload, budgetTotal: total > 0 ? total : 25000, createdAt: new Date().toISOString(), shareId: shareId || undefined };
        arr.unshift(item);
        local.write(arr);
        setItems(normalizeTrips(arr));
      }
      resetForm();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleEstimateBudget = async () => {
    if (!destination.trim() || !(Number(days) > 0) || !(Number(travelers) > 0)) {
      toast.warn('Please fill Destination, Days, and Travelers to calculate an estimate or enter your own amount.');
      return;
    }
    setEstimating(true);
    try {
      if (usingFirestore) {
        const token = await getFirebaseIdToken();
        if (token) {
          const res = await fetch(`${getApiBase()}/api/dreams/estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              destination: destination.trim(),
              days: Number(days) || undefined,
              travelers: Number(travelers) || undefined,
            }),
          });
          const data = await res.json().catch(()=>({}));
          if (!res.ok) throw new Error(data?.error || 'estimate fail');
          const amt = Number(data?.amount) || 25000;
          setBudget(String(amt));
          toast.success(`Estimated budget: ₹ ${amt.toLocaleString('en-IN')}`);
          return;
        }
      }
      // Local fallback: rough heuristic if API not available
      const base = 25000;
      const d = Math.max(1, Number(days) || 3);
      const t = Math.max(1, Number(travelers) || 1);
      const est = base * (d / 3) * (0.8 + 0.2 * t);
      setBudget(String(Math.round(est)));
      toast.info('Estimated budget (offline heuristic applied).');
    } catch (e) {
      toast.error(e?.message || 'Failed to estimate budget');
    } finally {
      setEstimating(false);
    }
  };

  const handleJoin = async () => {
    const code = (joinId || '').trim();
    if (!code) return;
    try {
      if (usingFirestore) {
        const token = await getFirebaseIdToken();
        if (token) {
          const res = await fetch(`${getApiBase()}/api/dreams/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ shareId: code }),
          });
          if (!res.ok) {
            const e = await res.json().catch(()=>({}));
            throw new Error(e?.error || 'Join failed');
          }
          await fetchDreams();
          setJoinId('');
          setShowForm(false);
          return;
        }
      }
  toast.warn('Join requires sign-in and server API. Please sign in or configure Firebase.');
    } catch (e) {
  toast.error(e?.message || 'Failed to join');
    }
  };

  const makeShareId = () => {
    const id = Math.random().toString(36).slice(2, 10).toUpperCase();
    setShareId(id);
  };

  // Edit / Update
  const [editTrip, setEditTrip] = useState(null);
  const [editBudget, setEditBudget] = useState('');
  const [editDate, setEditDate] = useState('');

  const openEdit = (trip) => {
    setEditTrip(trip);
    setEditBudget(String(trip?.budgetTotal || ''));
    setEditDate(trip?.targetDate || '');
  };

  const handleUpdateTrip = async () => {
    if (!editTrip) return;
    const newBudget = parseAmount(editBudget);
    try {
      if (usingFirestore) {
        const token = await getFirebaseIdToken();
        if (token) {
          const owner = editTrip.ownerUid || currentUser.uid;
          const qs = owner && owner !== currentUser.uid ? `?owner=${encodeURIComponent(owner)}` : '';
          const res = await fetch(`${getApiBase()}/api/dreams/${encodeURIComponent(editTrip.id)}${qs}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ budget: newBudget || undefined, targetDate: editDate || undefined }),
          });
          if (!res.ok) throw new Error('update fail');
          await fetchDreams();
        }
      } else {
        const arr = local.read();
        const idx = Array.isArray(arr) ? arr.findIndex(x => x.id === editTrip.id) : -1;
        if (idx >= 0) {
          arr[idx].budgetTotal = newBudget || arr[idx].budgetTotal;
          arr[idx].targetDate = editDate || null;
          local.write(arr);
          setItems(normalizeTrips(arr));
        }
      }
      setEditTrip(null);
    } catch (e) {
      toast.error('Failed to update trip');
    }
  };

  const duplicateTrip = async (trip) => {
    try {
      if (usingFirestore) {
        const token = await getFirebaseIdToken();
        if (token) {
          const res = await fetch(`${getApiBase()}/api/dreams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              destination: trip.destination,
              budget: trip.budgetTotal || undefined,
              days: trip.days || undefined,
              travelers: trip.travelers || undefined,
              targetDate: trip.targetDate || undefined,
              saved: 0,
              collaborative: false,
              currency: 'INR'
            })
          });
          if (!res.ok) throw new Error('dup fail');
          await fetchDreams();
          toast.success('Duplicated');
        }
      } else {
        const arr = local.read();
        const copy = { ...trip, id: `loc-${Date.now()}`, savedAmount: 0, createdAt: new Date().toISOString(), collaborative: false, shareId: undefined };
        arr.unshift(copy);
        local.write(arr);
        setItems(normalizeTrips(arr));
        toast.success('Duplicated');
      }
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const shareTrip = async (trip) => {
    try {
      if (trip.collaborative && trip.shareId) {
        const text = trip.shareId;
        await navigator.clipboard.writeText(text);
        toast.success('Collaboration ID copied');
      } else {
        toast.info('Enable collaboration and set an ID to share this trip.');
      }
    } catch {}
  };

  // Suggestions: destination (create) and search
  useEffect(() => {
    let to = null; let alive = true;
    const q = destination.trim();
    if (!q) { setDestSuggestions([]); setShowDestSug(false); return; }
    to = setTimeout(async () => {
      try {
        const token = await getFirebaseIdToken();
        const url = `${getApiBase()}/api/destinations/suggest?q=${encodeURIComponent(q.split(/[\n,]/).pop().trim())}`;
        const res = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!alive) return;
        if (!res.ok) throw new Error('no');
        const data = await res.json().catch(()=>({}));
        const list = Array.isArray(data?.suggestions) ? data.suggestions : (Array.isArray(data) ? data : []);
        setDestSuggestions(list.slice(0, 6));
        setShowDestSug(true);
      } catch {
        // fallback: use known destinations starting with last token
        const last = q.split(/[\n,]/).pop().trim().toLowerCase();
        const pool = Array.from(new Set(items.map(it => it.destination))).filter(Boolean);
        const list = pool.filter(d => d.toLowerCase().startsWith(last)).slice(0, 5);
        setDestSuggestions(list);
        setShowDestSug(list.length > 0);
      }
    }, 250);
    return () => { clearTimeout(to); alive = false; };
  }, [destination, items]);

  useEffect(() => {
    let to = null; let alive = true;
    const q = search.trim();
    if (!q) { setSearchSuggestions([]); setShowSearchSug(false); return; }
    to = setTimeout(async () => {
      try {
        const token = await getFirebaseIdToken();
        const url = `${getApiBase()}/api/destinations/suggest?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!alive) return;
        if (!res.ok) throw new Error('no');
        const data = await res.json().catch(()=>({}));
        const list = Array.isArray(data?.suggestions) ? data.suggestions : (Array.isArray(data) ? data : []);
        setSearchSuggestions(list.slice(0, 8));
        setShowSearchSug(true);
      } catch {
        const pool = Array.from(new Set(items.map(it => it.destination))).filter(Boolean);
        const list = pool.filter(d => d.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
        setSearchSuggestions(list);
        setShowSearchSug(list.length > 0);
      }
    }, 200);
    return () => { clearTimeout(to); alive = false; };
  }, [search, items]);

  // Close suggestion popovers on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (destSugRef.current && !destSugRef.current.contains(e.target)) setShowDestSug(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchSug(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const updateSavings = async (trip, delta) => {
    const inc = parseAmount(delta);
    if (!inc) return;
    const nextSaved = Math.max(0, Math.min((trip.savedAmount || 0) + inc, trip.budgetTotal || 0));
    if (usingFirestore) {
      try {
        const token = await getFirebaseIdToken();
        if (token) {
          const owner = trip.ownerUid || currentUser.uid;
          const qs = owner && owner !== currentUser.uid ? `?owner=${encodeURIComponent(owner)}` : '';
          const res = await fetch(`${getApiBase()}/api/dreams/${encodeURIComponent(trip.id)}${qs}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ saved: nextSaved }),
          });
          if (!res.ok) throw new Error('update fail');
          await fetchDreams();
        } else {
          const ref = doc(db, 'dreams', currentUser.uid, 'trips', trip.id);
          await updateDoc(ref, { savedAmount: nextSaved });
          await fetchDreams();
        }
      } catch {}
    } else {
      const arr = local.read();
      const idx = Array.isArray(arr) ? arr.findIndex((x) => x.id === trip.id) : -1;
      if (idx >= 0) {
        arr[idx].savedAmount = nextSaved;
        local.write(arr);
        setItems(normalizeTrips(arr));
      }
    }
  };

  const deleteTrip = async (trip) => {
    if (!trip?.id) return;
    const confirmDel = window.confirm('Delete this trip?');
    if (!confirmDel) return;
    try {
      if (usingFirestore) {
        const token = await getFirebaseIdToken();
        if (token) {
          const owner = trip.ownerUid || currentUser.uid;
          const qs = owner && owner !== currentUser.uid ? `?owner=${encodeURIComponent(owner)}` : '';
          const res = await fetch(`${getApiBase()}/api/dreams/${encodeURIComponent(trip.id)}${qs}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('delete fail');
          await fetchDreams();
        }
      } else {
        const arr = local.read();
        const next = Array.isArray(arr) ? arr.filter(x => x.id !== trip.id) : [];
        local.write(next);
        setItems(normalizeTrips(next));
      }
    } catch (e) {
      toast.error('Failed to delete trip');
    }
  };

  const toggleForm = () => {
    setShowForm(prev => !prev);
    if (!showForm) setMode('create');
  };

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero */}
        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-2xl md:text-3xl font-semibold">
              <span className="mr-2">🌍</span>
              <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">Dream Destinations</span>
            </div>
            <div className="text-sm text-white/70">Plan dream trips, track savings, and collaborate with friends.</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-sm">
              <Home className="w-4 h-4"/> Home
            </button>
            <button onClick={() => navigate('/begin')} className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-sm">
              <Rocket className="w-4 h-4"/> Begin Journey
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(true); setMode('create'); }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-3 py-2 hover:bg-emerald-400 shadow"
            >
              <Plus className="w-4 h-4" />
              New Dream Trip
            </button>
          </div>
        </div>

        {!usingFirestore ? (
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 text-amber-100 text-xs px-3 py-2">
            Firebase not configured or user not signed in. Saving to local device only.
          </div>
        ) : null}
        {/* Collaboration quick-join bar */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="text-sm text-white/80">Join an existing collaborative trip</div>
            <div className="flex items-center gap-2">
              <input
                value={joinId}
                onChange={(e)=>setJoinId(e.target.value.toUpperCase())}
                placeholder="Enter Collaboration ID"
                className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none w-64"
              />
              <button onClick={handleJoin} className="px-3 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400">Join Trip</button>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative" ref={searchRef}>
              <Search className="w-4 h-4 text-white/60 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e)=>setSearch(titleCaseLocationText(e.target.value))}
                placeholder="Search destination…"
                className="pl-7 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none"
              />
              {showSearchSug && searchSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-black/70 backdrop-blur-md p-1">
                  {searchSuggestions.map((s, i) => (
                    <button key={i} onClick={() => { setSearch(s); setShowSearchSug(false); }} className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-white/10">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2 ml-2">
              <button onClick={()=>setFilterMode('all')} className={`px-3 py-1.5 rounded-lg text-sm border ${filterMode==='all'?'border-emerald-300/60 bg-emerald-400/10 text-emerald-200':'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}>All</button>
              <button onClick={()=>setFilterMode('solo')} className={`px-3 py-1.5 rounded-lg text-sm border ${filterMode==='solo'?'border-emerald-300/60 bg-emerald-400/10 text-emerald-200':'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}>Solo</button>
              <button onClick={()=>setFilterMode('collab')} className={`px-3 py-1.5 rounded-lg text-sm border ${filterMode==='collab'?'border-emerald-300/60 bg-emerald-400/10 text-emerald-200':'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}>Collaborative</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-white/60" />
            <select value={sortKey} onChange={(e)=>setSortKey(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg text-sm px-3 py-2 outline-none">
              <option value="recent">Sort: Recent</option>
              <option value="targetDate">Sort: Nearest Target</option>
              <option value="savedPct">Sort: Saved %</option>
              <option value="budget">Sort: Highest Budget</option>
            </select>
            <button onClick={() => { setSearch(''); setFilterMode('all'); setSortKey('recent'); }} className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-sm hover:bg-white/10">Clear</button>
          </div>
        </div>

        {/* Quick chips */}
        {uniqueDestChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueDestChips.map((d) => (
              <button key={d} onClick={() => setSearch(d)} className="px-2.5 py-1 rounded-full text-[12px] border border-white/15 bg-white/5 hover:bg-white/10">{d}</button>
            ))}
          </div>
        )}

        {/* Metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="text-white/60">Trips</div>
            <div className="text-xl font-semibold">{items.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="text-white/60">Total Saved</div>
            <div className="text-xl font-semibold">₹ {items.reduce((s, t) => s + (Number(t.savedAmount)||0), 0).toLocaleString('en-IN')}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="text-white/60">Avg. Goal</div>
            <div className="text-xl font-semibold">₹ {items.length ? Math.round(items.reduce((s, t) => s + (Number(t.budgetTotal)||0), 0)/items.length).toLocaleString('en-IN') : 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div className="text-white/60">Collaborative</div>
            <div className="text-xl font-semibold">{items.filter(t => t.collaborative).length}</div>
          </div>
        </div>

        <div className="mt-4 text-sm text-white/70">Your Dream Trips</div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl h-40 border border-white/10 bg-white/5 animate-pulse" />
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full text-white/70 text-sm">No dream trips yet. Click “New Dream Trip” to get started.</div>
          ) : (
            filteredItems.map((it) => (
              <DreamCard
                key={it.id}
                trip={it}
                canDelete={!(usingFirestore && it.ownerUid && currentUser?.uid && it.ownerUid !== currentUser.uid)}
                onDelete={() => deleteTrip(it)}
                onAddSavings={(val) => updateSavings(it, val)}
                onEdit={() => openEdit(it)}
                onDuplicate={() => duplicateTrip(it)}
                onShare={() => shareTrip(it)}
              />
            ))
          )}
        </div>

        {/* Create/Join Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
              <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/10 text-white shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="font-semibold">{mode === 'join' ? 'Join Trip' : 'Create Dream Trip'}</div>
                  <button onClick={() => setShowForm(false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10" title="Close"><X className="w-4 h-4"/></button>
                </div>
                <div className="p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <button onClick={()=>setMode('create')} className={`px-3 py-1.5 rounded-lg text-sm border ${mode==='create'?'border-emerald-300/60 bg-emerald-400/10 text-emerald-200':'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}>Create</button>
                    <button onClick={()=>setMode('join')} className={`px-3 py-1.5 rounded-lg text-sm border ${mode==='join'?'border-emerald-300/60 bg-emerald-400/10 text-emerald-200':'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}>Join</button>
                  </div>

                  {mode === 'create' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/70">Destination</label>
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2">
                          <MapPin className="w-4 h-4 text-white/70" />
                          <input
                            ref={destInputRef}
                            value={destination}
                            onChange={(e) => setDestination(capitalizeLocationSegments(e.target.value))}
                            className="bg-transparent outline-none text-white/90 text-sm w-full"
                            placeholder="e.g., Palitana, Tokyo, Paris"
                          />
                          {/* Suggestions for destination */}
                          <div className="relative" ref={destSugRef} />
                        </div>
                        {showDestSug && destSuggestions.length > 0 && (
                          <div className="mt-1 rounded-lg border border-white/10 bg-black/70 backdrop-blur-md p-1">
                            {destSuggestions.map((s, i) => (
                              <button key={i} onClick={() => { setDestination(s); setShowDestSug(false); }} className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-white/10">
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-white/70">Estimated Budget</label>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="px-3 py-2 text-sm rounded-md border border-white/15 bg-white text-black">₹ INR</div>
                          <input
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            className="flex-1 bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none"
                            placeholder={`e.g., ₹ 85,000`}
                            inputMode="decimal"
                          />
                          <button
                            type="button"
                            onClick={handleEstimateBudget}
                            disabled={estimating}
                            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-sm disabled:opacity-50"
                            title="Estimate budget in INR using AI"
                          >
                            {estimating ? 'Estimating…' : 'Estimate with AI'}
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-white/60">Enter your amount or use Estimate with AI (INR only).</div>
                      </div>
                      <div>
                        <label className="text-xs text-white/70">Days</label>
                        <input
                          value={days}
                          onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))}
                          className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none"
                          placeholder="e.g., 5"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/70">Travelers</label>
                        <input
                          value={travelers}
                          onChange={(e) => setTravelers(e.target.value.replace(/[^0-9]/g, ''))}
                          className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none"
                          placeholder="e.g., 2"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/70">Target Date</label>
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2">
                          <CalendarDays className="w-4 h-4 text-white/70" />
                          <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="bg-transparent outline-none text-white/90 text-sm w-full"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input id="collab" type="checkbox" checked={collaborative} onChange={(e)=>setCollaborative(e.target.checked)} />
                        <label htmlFor="collab" className="text-sm text-white/80">Enable collaboration (generate an ID)</label>
                      </div>

                      {collaborative && (
                        <div className="md:col-span-2 rounded-lg border border-white/10 bg-black/30 p-3">
                          <div className="text-xs text-white/70 mb-2">Collaboration</div>
                          <div className="flex items-center gap-2">
                            <input
                              value={shareId}
                              onChange={(e) => setShareId(e.target.value.toUpperCase())}
                              placeholder="Collaboration ID (auto-generated)"
                              className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none"
                            />
                            <button type="button" onClick={makeShareId} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-sm">Generate</button>
                            <button type="button" onClick={() => { try { navigator.clipboard.writeText(shareId || ''); toast.success('Copied'); } catch {} }} className="px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15" title="Copy ID"><Copy className="w-4 h-4"/></button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === 'join' && (
                    <div>
                      <label className="text-xs text-white/70">Collaboration ID</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          value={joinId}
                          onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                          placeholder="Enter Collaboration ID"
                          className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none"
                        />
                        <button type="button" onClick={handleJoin} className="px-3 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-400">Join Trip</button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    {mode === 'create' ? (
                      <button
                        disabled={saving || !destination.trim()}
                        onClick={async()=>{ await handleSave(); }}
                        className="rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save Dream Trip'}
                      </button>
                    ) : (
                      <button onClick={handleJoin} className="rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400">Join Trip</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editTrip && (
          <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-0 flex items-start justify-center pt-20 px-4">
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/10 text-white shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="font-semibold">Edit Trip – {editTrip?.destination}</div>
                  <button onClick={() => setEditTrip(null)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10" title="Close"><X className="w-4 h-4"/></button>
                </div>
                <div className="p-4 grid gap-4">
                  <div>
                    <label className="text-xs text-white/70">Budget (₹)</label>
                    <input value={editBudget} onChange={(e)=>setEditBudget(e.target.value)} className="mt-1 w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-white/90 text-sm outline-none" inputMode="decimal" />
                  </div>
                  <div>
                    <label className="text-xs text-white/70">Target Date</label>
                    <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2">
                      <CalendarDays className="w-4 h-4 text-white/70" />
                      <input type="date" value={editDate} onChange={(e)=>setEditDate(e.target.value)} className="bg-transparent outline-none text-white/90 text-sm w-full" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleUpdateTrip} className="rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400">Update</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
