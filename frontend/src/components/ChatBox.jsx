import React, { useState, useEffect, useRef } from 'react';
import { getFirebaseIdToken } from '../lib/firebaseClient';
import ReactMarkdown from 'react-markdown';
import { Settings, Send, Bot, User, CornerDownLeft, Clock, Utensils, MapPin, Bed, Info, Lightbulb } from 'lucide-react';

// Render a JSON itinerary as cards
const ItineraryCards = ({ items }) => {
  const iconFor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'food': return Utensils;
      case 'activity': return MapPin;
      case 'lodging': return Bed;
      case 'info': return Info;
      case 'tip': return Lightbulb;
      default: return MapPin;
    }
  };
  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const Icon = iconFor(it.type);
        return (
          <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-white/10 grid place-items-center">
                <Icon className="w-4 h-4 text-white/90" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-white font-medium truncate">{it.title || 'Untitled'}</h4>
                  {it.time ? (
                    <span className="inline-flex items-center gap-1 text-xs text-white/80 bg-white/10 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" />{it.time}</span>
                  ) : null}
                </div>
                {it.description ? (
                  <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{it.description}</p>
                ) : null}
                {it.type ? (
                  <div className="mt-2 text-[11px] text-white/60 capitalize">{it.type}</div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// A simple component for individual chat messages
const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const Icon = isUser ? User : Bot;

  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      )}
      <div className={`max-w-xl p-4 rounded-2xl ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <ItineraryCards items={message.content} />
        ) : (
          <div className="prose prose-invert prose-p:my-0 prose-headings:my-2">
            <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
          </div>
        )}
      </div>
       {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white" />
        </div>
      )}
    </div>
  );
};

// Main Chatbox Component
const Chatbox = ({ onEditProfile, user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initial welcome message from the AI
    setMessages([{ role: 'assistant', content: `Welcome, ${user?.displayName || 'Traveler'}! Your Traveler's DNA is all set. Where would you like to go first?` }]);
  }, [user]);

  useEffect(() => {
    // Auto-scroll to the latest message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error("Authentication token not found.");
      }

            // Using the DNA endpoint for personalized itineraries
            const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
            const response = await fetch(`${base}/api/generate-itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get a response from the server.');
      }

      const data = await response.json();
      const content = Array.isArray(data?.itinerary) ? data.itinerary : (data?.itinerary || data);
      const assistantMessage = Array.isArray(content)
        ? { role: 'assistant', type: 'itinerary-json', content }
        : { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("API call failed:", error);
      const errorMessage = { role: 'assistant', content: `Sorry, I ran into a problem: ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
    
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-md bg-black/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
             <Bot className="w-5 h-5 text-white"/>
          </div>
          <h1 className="text-xl font-bold">Voyager AI</h1>
        </div>
        <div className="flex items-center gap-4">
           <p className="text-sm text-gray-400">Welcome, {user?.displayName || user?.email}</p>
          <button onClick={onEditProfile} className="text-gray-400 hover:text-white transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Message List */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}
           {isLoading && (
            <div className="flex items-start gap-4 my-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
                 <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="max-w-xl p-4 rounded-2xl bg-gray-800 text-gray-400 rounded-bl-none">
                Generating your next adventure...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-shrink-0 p-4">
        <div className="max-w-4xl mx-auto p-2 rounded-2xl border border-white/10 backdrop-blur-lg bg-black/30 focus-within:border-blue-500 transition-all">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., 'A 5-day cultural trip to Kyoto'"
              className="w-full bg-transparent text-gray-200 placeholder-gray-500 resize-none outline-none pl-4 pr-16 py-3"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
         <p className="text-xs text-center text-gray-500 mt-2">
          Press Shift + <CornerDownLeft size={10} className="inline-block"/> for a new line.
        </p>
      </footer>
    </div>
  );
};

export default Chatbox;

