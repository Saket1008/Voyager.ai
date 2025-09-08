import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, RefreshCw, Lightbulb, CheckCircle, Sparkles, ThumbsUp, ThumbsDown, Heart } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Avatar from './Avatar.jsx';
import TypingAnimation from './TypingAnimation.jsx';

const EnhancedChatMessage = ({ 
  message, 
  userName, 
  onCopy, 
  onRegenerate,
  isTyping = false,
  typingText = '',
  onTypingComplete 
}) => {
  const isUser = message.role === 'user';
  const [showThinking, setShowThinking] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const hasThinking = !!message?.contextUsed;

  // Redesigned styling with better colors and modern design
  const assistantCls = 'w-full max-w-[720px] rounded-3xl px-6 py-5 text-sm bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 text-white shadow-2xl shadow-slate-900/20';
  const userCls = 'ml-auto inline-block max-w-[70%] rounded-3xl px-5 py-4 text-sm font-medium text-white bg-gradient-to-br from-indigo-600 to-purple-700 border border-indigo-500/30 shadow-xl shadow-indigo-500/20';

  // Animation variants
  const messageVariants = {
    hidden: { 
      opacity: 0, 
      y: 20, 
      scale: 0.95,
      filter: 'blur(4px)'
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        duration: 0.4
      }
    }
  };

  const actionButtonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { delay: 0.2, duration: 0.2 }
    }
  };

  // Handle typing animation completion
  const handleTypingComplete = () => {
    setHasAnimated(true);
    onTypingComplete?.();
  };

  return (
    <motion.div 
      className={`flex items-start gap-4 my-6 ${isUser ? 'justify-end flex-row-reverse' : 'justify-start'}`}
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isUser && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
        >
          <Avatar role={message.role} />
        </motion.div>
      )}
      
      <div className={`${isUser ? 'flex flex-col items-end' : 'flex-1'}`}>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <motion.div 
            className={assistantCls}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ItineraryCards items={message.content} />
          </motion.div>
        ) : isUser ? (
          <motion.div 
            className={userCls}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            {message.content}
          </motion.div>
        ) : (
          <div>
            <motion.div 
              className={assistantCls}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="prose prose-invert prose-p:my-0 prose-headings:my-2 break-words">
                {isTyping && typingText ? (
                  <TypingAnimation 
                    text={typingText}
                    speed={25}
                    onComplete={handleTypingComplete}
                    enableCorrections={true}
                  />
                ) : (
                  <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
                )}
              </div>
              
              {/* Enhanced thinking indicator */}
              {isTyping && (
                <motion.div 
                  className="mt-3 flex items-center gap-2 text-xs text-white/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  <span>Voyager is crafting your response...</span>
                </motion.div>
              )}
            </motion.div>

            {/* Enhanced action buttons - only show on hover */}
            <AnimatePresence>
              {!isTyping && hasAnimated && isHovered && (
                <motion.div 
                  className="mt-3 flex items-center gap-2"
                  variants={actionButtonVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  <motion.button 
                    onClick={() => {
                      setLiked(!liked);
                      if (disliked) setDisliked(false);
                    }}
                    title="Like this response"
                    className={`h-8 w-8 rounded-lg border grid place-items-center transition-all duration-200 backdrop-blur-sm ${
                      liked 
                        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/50 text-green-400' 
                        : 'bg-gradient-to-br from-white/10 to-white/5 border-white/20 text-white/70 hover:bg-white/15'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </motion.button>

                  <motion.button 
                    onClick={() => {
                      setDisliked(!disliked);
                      if (liked) setLiked(false);
                    }}
                    title="Dislike this response"
                    className={`h-8 w-8 rounded-lg border grid place-items-center transition-all duration-200 backdrop-blur-sm ${
                      disliked 
                        ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border-red-400/50 text-red-400' 
                        : 'bg-gradient-to-br from-white/10 to-white/5 border-white/20 text-white/70 hover:bg-white/15'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </motion.button>
                  
                  <motion.button 
                    onClick={onRegenerate} 
                    title="Regenerate response"
                    className="h-8 w-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 grid place-items-center text-white/70 hover:bg-white/15 hover:scale-105 transition-all duration-200 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.button>
                  
                  <motion.button 
                    onClick={() => onCopy(String(message.content ?? ''))} 
                    title="Copy message"
                    className="h-8 w-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 grid place-items-center text-white/70 hover:bg-white/15 hover:scale-105 transition-all duration-200 backdrop-blur-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Copy className="w-4 h-4" />
                  </motion.button>
                  
                  {hasThinking && (
                    <motion.button
                      onClick={() => setShowThinking(v => !v)}
                      title={showThinking ? 'Hide thinking process' : 'Show thinking process'}
                      className="h-8 rounded-lg px-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 text-white/70 hover:bg-white/15 hover:scale-105 transition-all duration-200 flex items-center gap-1 text-xs backdrop-blur-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Lightbulb className="w-4 h-4" />
                      {showThinking ? 'Hide' : 'Thinking'}
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Enhanced thinking panel */}
            <AnimatePresence>
              {hasThinking && showThinking && (
                <motion.div 
                  className="mt-4 rounded-xl bg-gradient-to-br from-black/60 to-black/40 border border-white/15 p-4 text-xs text-white/80 backdrop-blur-xl"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-2 font-medium text-white/90 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Context & Analysis Used
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 opacity-90 bg-black/20 p-2 rounded-lg">
                    {JSON.stringify(message.contextUsed, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {isUser && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
        >
          <Avatar role={message.role} name={userName} />
        </motion.div>
      )}
    </motion.div>
  );
};

// Enhanced ItineraryCards component
const ItineraryCards = ({ items }) => {
  const iconFor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'food': return '🍽️';
      case 'activity': return '📍';
      case 'lodging': return '🏨';
      case 'info': return 'ℹ️';
      case 'tip': return '💡';
      default: return '📍';
    }
  };

  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <motion.div 
          key={idx} 
          className="rounded-xl border border-white/15 bg-gradient-to-br from-white/8 to-white/4 backdrop-blur-md p-4 shadow-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-8 w-8 rounded-full bg-gradient-to-br from-white/15 to-white/5 grid place-items-center text-lg">
              {iconFor(it.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-white font-medium truncate">{it.title || 'Untitled'}</h4>
                {it.time && (
                  <span className="inline-flex items-center gap-1 text-xs text-white/80 bg-white/10 rounded-full px-2 py-0.5 backdrop-blur-sm">
                    🕐 {it.time}
                  </span>
                )}
              </div>
              {it.description && (
                <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{it.description}</p>
              )}
              {it.type && (
                <div className="mt-2 text-[11px] text-white/60 capitalize bg-white/5 px-2 py-1 rounded-md inline-block">
                  {it.type}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default EnhancedChatMessage;
