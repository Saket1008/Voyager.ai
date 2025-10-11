import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Users, MapPin } from 'lucide-react';

export default function OrganizerTripDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // For now, a lightweight placeholder; can be wired to fetch `/api/organizer/trips/:id`
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-2xl md:text-3xl font-semibold mb-1">Trip Details</div>
        <div className="text-sm text-white/70 mb-4">ID: {id}</div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="text-sm text-white/80">This page will show itinerary, members, logistics, and files for the selected trip.</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-white/70"><Calendar className="w-4 h-4" /> Dates: —</div>
            <div className="flex items-center gap-2 text-sm text-white/70"><MapPin className="w-4 h-4" /> Destination: —</div>
            <div className="flex items-center gap-2 text-sm text-white/70"><Users className="w-4 h-4" /> Members: —</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
