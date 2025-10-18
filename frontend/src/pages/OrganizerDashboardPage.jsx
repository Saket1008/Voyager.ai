import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/apiBase';
import { toast } from '../lib/toast';
import { Calendar, Users, MapPin, Upload, Eye, PlusCircle, ClipboardList, PackageSearch } from 'lucide-react';
import { titleCaseLocationText } from '../lib/format';

const tabs = [
  { key: 'trips', label: 'Active Trips' },
  { key: 'members', label: 'Members' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'uploads', label: 'Upload PDFs' },
];

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-emerald-400/10 border border-emerald-300/30 text-emerald-200">
          {Icon ? <Icon className="w-5 h-5" /> : null}
        </div>
        <div>
          <div className="text-xs text-white/60">{title}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip, onView }) {
  const memberCount = Array.isArray(trip.members) ? trip.members.length : (trip.membersCount || 0);
  const dates = [trip.startDate, trip.endDate].filter(Boolean).join(' → ');
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md hover:border-cyan-300/40 hover:shadow-[0_10px_30px_rgba(34,211,238,0.25)] transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{trip.title || 'Trip'}</div>
          <div className="text-xs text-white/70 truncate flex items-center gap-2 mt-0.5">
            <Calendar className="w-3.5 h-3.5" /> <span>{dates || '—'}</span>
          </div>
          <div className="text-xs text-white/70 truncate flex items-center gap-2 mt-0.5">
            <MapPin className="w-3.5 h-3.5" /> <span>{trip.destination || '—'}</span>
          </div>
          <div className="text-xs text-white/60 mt-1">{memberCount} members • {trip.status || 'upcoming'}</div>
        </div>
        <button onClick={() => onView?.(trip)} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
          <Eye className="w-4 h-4" /> View Details
        </button>
      </div>
    </motion.div>
  );
}

export default function OrganizerDashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Trip form state
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [destination, setDestination] = useState('');

  const metrics = useMemo(() => {
    const now = new Date();
    const toDate = (s) => (s ? new Date(s) : null);
    const statusOf = (t) => {
      const sd = toDate(t.startDate);
      const ed = toDate(t.endDate);
      if (sd && ed) {
        if (now < sd) return 'upcoming';
        if (now >= sd && now <= ed) return 'ongoing';
        return 'completed';
      }
      if (sd && now < sd) return 'upcoming';
      return 'upcoming';
    };
    const withStatus = trips.map(t => ({ ...t, status: t.status || statusOf(t) }));
    const total = withStatus.length;
    const upcoming = withStatus.filter(t => t.status === 'upcoming').length;
    const ongoing = withStatus.filter(t => t.status === 'ongoing').length;
    const completed = withStatus.filter(t => t.status === 'completed').length;
    const members = withStatus.reduce((sum, t) => sum + (Array.isArray(t.members) ? t.members.length : (t.membersCount || 0)), 0);
    return { total, upcoming, ongoing, completed, members };
  }, [trips]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        const res = await fetch(`${getApiBase()}/api/organizer/trips`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json().catch(()=>({}));
        const list = Array.isArray(data?.trips) ? data.trips : (Array.isArray(data) ? data : []);
        if (mounted) setTrips(list);
      } catch (e) {
        if (mounted) setTrips([
          { id: 't1', title: 'Goa Long Weekend', startDate: '2025-11-14', endDate: '2025-11-17', destination: 'Goa', membersCount: 12, status: 'upcoming' },
          { id: 't2', title: 'Himalayan Trek', startDate: '2025-10-20', endDate: '2025-10-26', destination: 'Kedarkantha', membersCount: 18, status: 'ongoing' },
          { id: 't3', title: 'Golden Triangle', startDate: '2025-09-01', endDate: '2025-09-05', destination: 'Delhi • Jaipur • Agra', membersCount: 25, status: 'completed' },
        ]);
        toast.info('Showing sample trips (API unavailable).');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentUser]);

  const handleView = (trip) => {
    navigate(`/organizer/trip/${trip.id || 'unknown'}`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (!title || !startDate || !endDate || !destination) { toast.warn('Please fill all fields'); return; }
      const payload = { title, startDate, endDate, destination };
      const token = currentUser ? await currentUser.getIdToken() : null;
      const res = await fetch(`${getApiBase()}/api/organizer/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      let out = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(out?.error || 'Failed to create trip');
      const created = out?.trip || { id: `t-${Date.now()}`, ...payload, membersCount: 0, status: 'upcoming' };
      setTrips(prev => [created, ...prev]);
      setTitle(''); setStartDate(''); setEndDate(''); setDestination('');
      toast.success('Trip created');
    } catch (err) {
      // Local create fallback
      const created = { id: `t-${Date.now()}`, title, startDate, endDate, destination, membersCount: 0, status: 'upcoming' };
      setTrips(prev => [created, ...prev]);
      setTitle(''); setStartDate(''); setEndDate(''); setDestination('');
      toast.info('Trip created locally (API unavailable).');
    }
  };

  const handleUpload = async (files) => {
    try {
      if (!files || !files.length) return;
      // Demonstrative mock; integrate with your tickets processor later
      toast.success(`${files.length} file(s) queued for processing (coming soon)`);
    } catch (e) {
      toast.error('Upload failed');
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-1">
          <div className="text-2xl md:text-3xl font-semibold">🧭 Organizer Dashboard</div>
          <div className="text-sm text-white/70">Manage your group trips and travelers effortlessly.</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard title="Total Trips" value={metrics.total} icon={ClipboardList} />
          <StatCard title="Upcoming" value={metrics.upcoming} icon={Calendar} />
          <StatCard title="Ongoing" value={metrics.ongoing} icon={PackageSearch} />
          <StatCard title="Members" value={metrics.members} icon={Users} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1.5 text-sm rounded-lg border ${activeTab===t.key ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'trips' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Trip list */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {trips.length === 0 ? (
                    <div className="text-sm text-white/70">No trips yet. Create your first group trip.</div>
                  ) : trips.map(t => (
                    <TripCard key={t.id} trip={t} onView={handleView} />
                  ))}
                </div>
              )}
            </div>

            {/* Create new trip */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <PlusCircle className="w-4 h-4 text-emerald-300" />
                <div className="font-semibold">Add New Trip</div>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="text-xs text-white/70">Title</label>
                  <input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" placeholder="Trip title" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/70">Start Date</label>
                    <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-white/70">End Date</label>
                    <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/70">Destination</label>
                  <input value={destination} onChange={(e)=>setDestination(titleCaseLocationText(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none" placeholder="e.g., Goa" />
                </div>
                <div className="pt-1">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400">
                    Create Trip
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {activeTab === 'members' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="text-sm text-white/80">Members management coming soon. You’ll be able to invite, approve requests, and set roles per trip.</div>
          </motion.div>
        )}

        {activeTab === 'logistics' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="text-sm text-white/80">Coordinate transport, stays, and activities across your members. Integrations with Bookings and Itinerary coming soon.</div>
          </motion.div>
        )}

        {activeTab === 'uploads' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-cyan-300" />
              <div className="font-semibold">Upload PDFs (tickets & invoices)</div>
            </div>
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/20 cursor-pointer w-fit">
              <Upload className="w-4 h-4" /> Choose PDF(s)
              <input type="file" className="hidden" accept="application/pdf" multiple onChange={(e)=>handleUpload(e.target.files)} />
            </label>
            <div className="text-xs text-white/60 mt-2">We’ll parse travel details and attach them to the selected trip (coming soon).</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
