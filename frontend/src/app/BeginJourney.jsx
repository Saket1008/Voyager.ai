import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import OneClickItinerary from '../components/OneClickItinerary.jsx'
import LocationAwarePanel from '../components/LocationAwarePanel.jsx'
import {
  Compass,
  Globe,
  Sparkles,
  Rocket,
  MessageSquare,
  UserCog,
  Zap,
  Timer,
  Brain,
  Moon,
  Users,
  FileText,
  Store,
  Wallet,
  BookOpen,
  CreditCard,
  ShieldCheck,
  Leaf
} from 'lucide-react'

// Copy constants so marketing text is easy to tweak
const HERO = {
  title: 'Begin Your Journey with Voyager.ai',
  tagline: 'From Impossible Itineraries to Dream Destinations',
  cta: 'Start Planning Now'
}

const PHASES = [
  {
    key: 'phase1',
    title: 'Phase 1 · MVP',
    features: [
      { icon: Compass, title: 'AI Itinerary Generator', desc: 'Create rich, day-by-day plans in seconds.' },
      { icon: Sparkles, title: 'Impossible Itinerary', desc: 'Push the limits; we sculpt plans others won’t.' },
      { icon: MessageSquare, title: 'Conversational Chat', desc: 'Plan via a guided, fast, friendly chat.' },
      { icon: UserCog, title: 'Profile Editing', desc: 'Tune your Travel DNA—pace, budget, interests.' },
    ],
  },
  {
    key: 'phase2',
    title: 'Phase 2 · B2C Game‑Changers',
    features: [
      { icon: Zap, title: 'One‑Click Itinerary', desc: 'Instant trip plans from a single prompt.' },
      { icon: Rocket, title: 'Live Adventure Mode', desc: 'Adaptive schedule that reacts to your day.' },
      { icon: Brain, title: 'Memory Weaver', desc: 'Learns your style across trips automatically.' },
      { icon: Globe, title: '🌍 Dream Destinations', desc: 'Set your dream trip, track your savings, and even plan collaboratively with friends.' },
    ],
  },
  {
    key: 'phase3',
    title: 'Phase 3 · B2B & Community',
    features: [
      { icon: Users, title: 'Community Platform', desc: 'Share, fork, and remix itineraries.' },
      { icon: Wallet, title: 'Group Trip Management', desc: 'Coordinate invites, roles, and tasks.' },
      { icon: FileText, title: 'AI‑Powered PDF Processing', desc: 'Parse tickets, bookings, and docs.' },
      { icon: Store, title: 'Tour Marketplace', desc: 'Book local experiences natively.' },
      { icon: CreditCard, title: 'Integrated Expense Splitting', desc: 'Track and settle with zero hassle.' },
    ],
  },
  {
    key: 'phase4',
    title: 'Phase 4 · Loyalty & Fintech',
    features: [
      { icon: BookOpen, title: 'Dreamer’s Journal', desc: 'Capture ideas and convert to trips.' },
      { icon: Timer, title: 'Automated Trip Savings', desc: 'Smart goals that match your timeline.' },
      { icon: ShieldCheck, title: 'Voyager Guarantee', desc: 'Confidence with helpful protections.' },
      { icon: Leaf, title: 'Carbon Conscious Voyager', desc: 'Greener choices with clear impact.' },
    ],
  },
]

const containerVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06, duration: 0.6, ease: 'easeOut' } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
}

function GlowDivider() {
  return (
    <div className="relative my-10">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"></div>
      <div className="absolute -top-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300/80 blur-[2px]" />
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc, onClick, interactive = false }) {
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`group relative rounded-2xl border border-cyan-300/30 bg-white/5 p-5 backdrop-blur-md transition-all duration-300 hover:border-cyan-300/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${interactive ? 'cursor-pointer' : ''}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-300/10 via-transparent to-blue-300/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-cyan-200 shadow-inner shadow-cyan-500/10">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-white/90">{title}</h4>
          <p className="mt-1 text-sm text-white/70">{desc}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function BeginJourney() {
  const navigate = useNavigate()
  const handleStart = () => navigate('/')
  const [showOneClickDemo, setShowOneClickDemo] = React.useState(false)
  const [showLiveDemo, setShowLiveDemo] = React.useState(false)

  return (
    <div className="relative z-10 min-h-screen px-4 py-20 sm:px-6 lg:px-10">
      {/* Hero */}
      <div className="mx-auto max-w-5xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight text-white"
        >
          {HERO.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
          className="mt-4 text-lg sm:text-xl text-cyan-200/90"
        >
          {HERO.tagline}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8"
        >
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-6 py-3 text-cyan-100 backdrop-blur hover:bg-cyan-400/20 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)]"
          >
            <Rocket className="h-5 w-5" /> {HERO.cta}
          </button>
          <button
            onClick={() => navigate('/memory')}
            className="ml-3 inline-flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-400/10 px-6 py-3 text-amber-100 backdrop-blur hover:bg-amber-400/20 hover:shadow-[0_0_25px_rgba(251,191,36,0.25)]"
            title="Generate a travel journal from your journeys"
          >
            📖 Memory Weaver
          </button>
          <button
            onClick={() => navigate('/bookings')}
            className="ml-3 inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-6 py-3 text-cyan-100 backdrop-blur hover:bg-cyan-400/20 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)]"
            title="View all flights and trains your itinerary needs — best, cheapest, and fastest options."
          >
            ✈️ Bookings Required
          </button>
          <button
            onClick={() => navigate('/dreams')}
            className="ml-3 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-white backdrop-blur hover:bg-white/20"
            title="Plan and collaborate on dream destinations"
          >
            🌍 Dream Destinations
          </button>
          <button
            onClick={() => navigate('/community')}
            className="mt-3 sm:mt-0 ml-0 sm:ml-3 inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/60 bg-fuchsia-400/10 px-6 py-3 text-fuchsia-100 backdrop-blur hover:bg-fuchsia-400/20 hover:shadow-[0_0_25px_rgba(244,114,182,0.25)]"
            title="Discover travelers and groups"
          >
            👥 Community
          </button>
          <button
            onClick={() => navigate('/organizer')}
            className="ml-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-400/10 px-6 py-3 text-emerald-100 backdrop-blur hover:bg-emerald-400/20 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]"
            title="Manage group trips and travelers"
          >
            🧭 Organizer Dashboard
          </button>
          </motion.div>
      </div>

      {/* Phases */}
      <div className="mx-auto mt-14 max-w-6xl">
        {PHASES.map((phase, idx) => (
          <section key={phase.key} className="mb-12">
            <GlowDivider />
            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              className="mb-6 pl-1 text-2xl font-semibold tracking-wide text-white/90"
            >
              {phase.title}
            </motion.h3>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {phase.features.map((f, i) => {
                const isOneClick = phase.key === 'phase2' && /One\u2011?Click Itinerary|One-Click Itinerary/i.test(f.title)
                const isLive = phase.key === 'phase2' && /Live Adventure Mode/i.test(f.title)
                const isDreams = phase.key === 'phase2' && (String(f.title || '').includes('Dream Destinations'))
                return (
                  <FeatureCard
                    key={`${phase.key}-${i}`}
                    icon={f.icon}
                    title={f.title}
                    desc={f.desc}
                    onClick={
                      isOneClick
                        ? () => setShowOneClickDemo(v => !v)
                        : isLive
                          ? () => setShowLiveDemo(v => !v)
                          : (isDreams ? () => navigate('/dreams') : undefined)
                    }
                    interactive={isOneClick || isLive || isDreams}
                  />
                )
              })}
            </motion.div>

            {/* Inline live demo panel for One‑Click Itinerary under Phase 2 */}
            {phase.key === 'phase2' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: (showOneClickDemo || showLiveDemo) ? 1 : 0.6, height: (showOneClickDemo || showLiveDemo) ? 'auto' : 0 }}
                transition={{ duration: 0.35 }}
                className={`overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/5 backdrop-blur mt-5 ${showOneClickDemo ? 'p-4' : 'p-0'}`}
              >
                {(showOneClickDemo || showLiveDemo) && (
                  <div className="space-y-6">
                    {showOneClickDemo && (
                      <div>
                        <div className="mb-3 text-sm text-cyan-200/80">
                          Live demo: generate an itinerary instantly using your saved Traveler DNA.
                        </div>
                        <OneClickItinerary />
                      </div>
                    )}
                    {showLiveDemo && (
                      <div>
                        <div className="mb-3 text-sm text-cyan-200/80 flex items-center justify-between">
                          <span>Live Adventure (Preview): location-aware panel</span>
                          <button onClick={() => navigate('/live')} className="text-cyan-300 hover:underline">Open full page →</button>
                        </div>
                        <LocationAwarePanel />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </section>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mx-auto mt-10 max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-6 py-3 text-cyan-100 backdrop-blur hover:bg-cyan-400/20 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)]"
          >
            <Rocket className="h-5 w-5" /> {HERO.cta}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
