import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Compass, Share2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/apiBase';
import { titleCaseLocationText } from '../lib/format';
import { toast } from '../lib/toast';

function Chip({ children }) {
  return (
    <span className="text-[10px] rounded-full px-2 py-0.5 border border-white/15 bg-white/5 text-white/80">
      {children}
    </span>
  );
}

function UserCard({ user, onConnect }) {
  const interests = Array.isArray(user?.interests) ? user.interests : (typeof user?.interests === 'string' ? user.interests.split(',').map(s=>s.trim()).filter(Boolean) : []);
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md hover:border-cyan-300/40 hover:shadow-[0_10px_30px_rgba(34,211,238,0.25)] transition">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 border border-cyan-300/30 text-cyan-200">
          <Users className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{user?.name || 'Traveler'}</div>
          <div className="text-xs text-white/70 truncate">{user?.origin ? `From ${user.origin}` : 'Origin: —'} • {user?.travelStyle || 'Style: —'}</div>
          {!!interests.length && (
            <div className="mt-2 flex flex-wrap gap-1">
              {interests.slice(0, 6).map((t, i) => <Chip key={i}>{t}</Chip>)}
              {interests.length > 6 ? <Chip>+{interests.length - 6}</Chip> : null}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end">
        <button onClick={() => onConnect?.(user)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-3 py-1.5 hover:bg-emerald-400">
          Connect
        </button>
      </div>
    </motion.div>
  );
}

export default function CommunityPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [destQuery, setDestQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        const res = await fetch(`${getApiBase()}/api/community`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json().catch(()=>({}));
        const list = Array.isArray(data?.travelers) ? data.travelers : (Array.isArray(data) ? data : []);
        if (mounted) setUsers(list);
      } catch (e) {
        // Fallback mock
        if (mounted) setUsers([
          { id: 'u1', name: 'Ananya', origin: 'Bengaluru', travelStyle: 'Backpacker', interests: ['Mountains', 'Street Food', 'Hostels'] },
          { id: 'u2', name: 'Rohit', origin: 'Delhi', travelStyle: 'Comfort', interests: ['Museums', 'City Walks', 'Photography'] },
          { id: 'u3', name: 'Meera', origin: 'Mumbai', travelStyle: 'Luxury', interests: ['Beach', 'Spa', 'Fine Dining'] },
        ]);
        toast.info('Showing sample travelers (API unavailable).');
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };
    const fetchGroups = async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/circles/public`);
        const data = await res.json().catch(()=>({}));
        const list = Array.isArray(data?.groups) ? data.groups : (Array.isArray(data) ? data : []);
        if (mounted) setGroups(list);
      } catch (e) {
        if (mounted) setGroups([
          { id: 'g1', name: 'Himalaya Trekkers', topic: 'Uttarakhand • Kedarkantha', members: 128 },
          { id: 'g2', name: 'Goa Beach Bums', topic: 'Goa • Beaches & Cafes', members: 342 },
          { id: 'g3', name: 'Cultural Capitals', topic: 'Delhi • Jaipur • Agra', members: 89 },
        ]);
        toast.info('Showing sample groups (API unavailable).');
      } finally {
        if (mounted) setLoadingGroups(false);
      }
    };
    fetchUsers();
    fetchGroups();
    return () => { mounted = false; };
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    if (!destQuery) return users;
    const q = destQuery.toLowerCase();
    return users.filter(u =>
      (u.origin && String(u.origin).toLowerCase().includes(q)) ||
      (Array.isArray(u.interests) && u.interests.some(t => String(t).toLowerCase().includes(q)))
    );
  }, [users, destQuery]);

  const filteredGroups = useMemo(() => {
    if (!destQuery) return groups;
    const q = destQuery.toLowerCase();
    return groups.filter(g => (g.topic && String(g.topic).toLowerCase().includes(q)) || (g.name && String(g.name).toLowerCase().includes(q)));
  }, [groups, destQuery]);

  const handleConnect = (user) => {
    toast.success(`Request sent to ${user?.name || 'traveler'} (coming soon)`);
  };

  const handleJoin = async () => {
    try {
      const code = String(joinCode || '').trim();
      if (!code) { toast.warn('Enter a group code'); return; }
      const token = currentUser ? await currentUser.getIdToken() : null;
      const res = await fetch(`${getApiBase()}/api/circles/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to join group');
      toast.success('Joined group successfully');
      setJoinCode('');
    } catch (e) {
      toast.error(e?.message || 'Failed to join group');
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <div className="text-2xl md:text-3xl font-semibold">🌐 Voyager Community</div>
            <div className="text-sm text-white/70">Find travel companions and explore together.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/circles')}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-400/10 px-4 py-2 text-cyan-100 hover:bg-cyan-400/20"
              title="Create a new group"
            >
              <Share2 className="w-4 h-4" /> Create Group
            </button>
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5">
              <Search className="w-4 h-4 text-white/70" />
              <input
                value={destQuery}
                onChange={(e)=>setDestQuery(titleCaseLocationText(e.target.value))}
                placeholder="Search destination…"
                className="bg-transparent outline-none text-sm placeholder:text-white/50 w-44"
              />
              <input
                type="date"
                value={dateQuery}
                onChange={(e)=>setDateQuery(e.target.value)}
                className="bg-transparent outline-none text-sm text-white/80"
                title="Optional date (future: smarter filtering)"
              />
            </div>
          </div>
        </div>

        {/* Join Group */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Compass className="w-4 h-4 text-white/70" />
              <input
                value={joinCode}
                onChange={(e)=>setJoinCode(e.target.value)}
                placeholder="Enter group code to join"
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
            <button onClick={handleJoin} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 hover:bg-emerald-400">
              Join Group
            </button>
          </div>
        </motion.div>

        {/* Suggested Travelers */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-cyan-200" />
            <div className="font-semibold">Suggested Travelers</div>
          </div>
          {loadingUsers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.length === 0 ? (
                <div className="text-sm text-white/70">No travelers match your search.</div>
              ) : filteredUsers.map(u => (
                <UserCard key={u.id || u.name} user={u} onConnect={handleConnect} />
              ))}
            </div>
          )}
        </div>

        {/* Popular Groups */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="w-4 h-4 text-cyan-200" />
            <div className="font-semibold">Popular Groups</div>
          </div>
          {loadingGroups ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.length === 0 ? (
                <div className="text-sm text-white/70">No groups match your search.</div>
              ) : filteredGroups.map(g => (
                <motion.div key={g.id || g.name} whileHover={{ y: -2 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md hover:border-cyan-300/40 hover:shadow-[0_10px_30px_rgba(34,211,238,0.25)] transition">
                  <div className="font-semibold truncate">{g.name || 'Group'}</div>
                  <div className="text-xs text-white/70 truncate">{g.topic || '—'}</div>
                  <div className="text-xs text-white/60 mt-1">{g.members ? `${g.members} members` : ''}</div>
                  <div className="mt-3 flex items-center justify-end">
                    <button onClick={() => toast.info('Group details coming soon')} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
                      View
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
