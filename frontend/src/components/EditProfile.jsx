import React, { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebaseClient';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function EditProfile({ onClose }) {
  const [profile, setProfile] = useState({ pace: '', budget: '', interests: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const u = auth?.currentUser;
        if (!u) { setLoading(false); return; }
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data()?.travelProfile || {};
          setProfile({
            pace: data.pace || '',
            budget: data.budget || '',
            interests: Array.isArray(data.interests) ? data.interests.join(', ') : (data.interests || ''),
          });
        }
      } catch (e) {
        setError('Failed to load profile. Please try again.');
        console.error(e);
      } finally { setLoading(false); }
    }
    fetchProfile();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const u = auth?.currentUser;
      if (!u) return;
      const ref = doc(db, 'users', u.uid);
      const updated = {
        pace: profile.pace,
        budget: profile.budget,
        interests: String(profile.interests || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      };
      await updateDoc(ref, { travelProfile: updated });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      console.error(e);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function onChange(e) { const { name, value } = e.target; setProfile(p => ({ ...p, [name]: value })); }

  if (loading) return <div className="text-center p-8">Loading Profile...</div>;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6">Edit Your Traveler's DNA</h2>
        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">Travel Pace</label>
            <select name="pace" value={profile.pace} onChange={onChange} className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-3">
              <option value="Relaxed">Relaxed</option>
              <option value="Balanced">Balanced</option>
              <option value="Fast-Paced">Fast-Paced</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">Budget</label>
            <select name="budget" value={profile.budget} onChange={onChange} className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-3">
              <option value="Budget-Friendly">Budget-Friendly</option>
              <option value="Mid-Range">Mid-Range</option>
              <option value="Luxury">Luxury</option>
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Interests</label>
            <input type="text" name="interests" value={profile.interests} onChange={onChange} placeholder="e.g., History, Food, Hiking" className="w-full bg-gray-800 text-white border-gray-600 rounded-lg p-3" />
            <p className="text-xs text-gray-500 mt-1">Separate interests with a comma.</p>
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {success && <p className="text-green-500 text-sm mb-4">{success}</p>}
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="py-2 px-5 text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Close</button>
            <button type="submit" disabled={saving} className="py-2 px-5 text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
