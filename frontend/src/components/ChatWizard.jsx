import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export default function ChatWizard({ onComplete }) {
  const { getToken, isSignedIn } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [context, setContext] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Start the conversation
  useEffect(() => {
    setMessages([
      {
        role: "bot",
        text: "👋 Welcome to Voyager! Where do you want to travel?",
        options: ["Specific locations", "Regions"],
      },
    ]);
  }, []);

  const addUserMessage = (text) => {
    setMessages((prev) => [...prev, { role: "user", text }]);
  };

  const addBotMessage = (text, options) => {
    setMessages((prev) => [...prev, { role: "bot", text, options }]);
  };

  const handleOptionClick = (option) => {
    addUserMessage(option);

    if (step === 0) {
      if (option === "Specific locations") {
        addBotMessage("Great! Enter the exact location(s) (e.g., Germany, France, UK).");
      } else {
        addBotMessage("Awesome! Enter the region you want to explore (e.g., Europe).");
      }
      setStep(1);
    }

    if (step === 6) {
      // trip type
      setContext((c) => ({ ...c, tripType: option }));
      addBotMessage("💰 What's your budget preference?", [
        "Saver",
        "Economical",
        "Premium",
        "No Limit",
      ]);
      setStep(7);
    }

    if (step === 7) {
      // budget
      setContext((c) => ({ ...c, budget: option }));
      addBotMessage("✅ Thanks! Generating your itinerary...");
      generateItinerary();
      setStep(8);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    addUserMessage(input);

    if (step === 1) {
      // destinations entered
      setContext((c) => ({ ...c, destinations: input }));
      addBotMessage("📅 How many days do you want to travel?");
      setStep(2);
    }

    else if (step === 2) {
      // number of days
      setContext((c) => ({ ...c, days: input }));
      addBotMessage("🗓️ When are you planning to start? (e.g., June 2024)");
      setStep(3);
    }

    else if (step === 3) {
      // start date
      setContext((c) => ({ ...c, startDate: input }));
      addBotMessage("👥 How many adults and children are traveling? (e.g., 2, 1)");
      setStep(4);
    }

    else if (step === 4) {
      // number of people
      const [adults, kids] = input.split(",").map((x) => x.trim());
      setContext((c) => ({
        ...c,
        adults: adults || "1",
        kids: kids || "0",
      }));
      addBotMessage("🎯 What type of trip do you prefer?", [
        "Adventure",
        "Relaxing",
        "Couples",
        "Pilgrimage",
      ]);
      setStep(6);
    }

    setInput("");
  };

  const generateItinerary = async () => {
    if (!isSignedIn) {
      addBotMessage("⚠️ Please sign in to generate an itinerary.");
      return;
    }

    setIsGenerating(true);
    try {
      const token = await getToken();
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
      
      // Create a comprehensive prompt from the context
      const prompt = `Plan a ${context.days || '7'}-day trip to ${context.destinations || 'Europe'} starting ${context.startDate || 'next month'} for ${context.adults || '2'} adults and ${context.kids || '0'} children. Budget: ${context.budget || 'Economical'}. Trip type: ${context.tripType || 'Adventure'}.`;
      
      const res = await fetch(`${base}/api/itinerary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
      }
      
      const data = await res.json();
      const formatted = formatItineraryText(data);
      addBotMessage(`🗺️ Here's your itinerary:\n\n${formatted}`);
      
      // Call the completion callback to close the wizard
      if (onComplete) {
        setTimeout(() => onComplete(formatted), 2000);
      }
    } catch (err) {
      addBotMessage(`⚠️ Error generating itinerary: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatItineraryText = (data) => {
    const flights = Array.isArray(data?.flights) ? data.flights : [];
    const hotels = Array.isArray(data?.hotels) ? data.hotels : [];
    const activities = Array.isArray(data?.activities) ? data.activities : [];

    const lines = [];
    lines.push("Flights:");
    if (flights.length) {
      flights.forEach((f, i) =>
        lines.push(`  ${i + 1}. ${f.from || "?"} → ${f.to || "?"} on ${f.date || "?"}`)
      );
    } else {
      lines.push("  (none)");
    }
    lines.push("");
    lines.push("Hotels:");
    if (hotels.length) {
      hotels.forEach((h, i) =>
        lines.push(`  ${i + 1}. ${h.name || "?"}: ${h.checkIn || "?"} → ${h.checkOut || "?"}`)
      );
    } else {
      lines.push("  (none)");
    }
    lines.push("");
    lines.push("Activities:");
    if (activities.length) {
      activities.forEach((a, i) =>
        lines.push(`  Day ${a.day ?? "?"}: ${a.activity || "?"}`)
      );
    } else {
      lines.push("  (none)");
    }
    return lines.join("\n");
  };

  return (
    <div className="space-y-3">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`px-4 py-2 rounded-2xl max-w-xs whitespace-pre-line ${
              msg.role === "user"
                ? "bg-[#1f6feb] text-white rounded-br-none"
                : "bg-black/60 backdrop-blur-sm border border-white/20 text-white rounded-bl-none"
            }`}
          >
            {msg.text}
            {msg.options && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionClick(opt)}
                    className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-sm text-white hover:bg-white/20 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      
      {isGenerating && (
        <div className="flex justify-start">
          <div className="px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-sm border border-white/20 text-white rounded-bl-none">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:0ms]"></span>
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:120ms]"></span>
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:240ms]"></span>
              </div>
              <span className="text-sm">Generating your itinerary...</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <input
          className="flex-1 border border-white/20 rounded-full px-4 py-2 bg-black/40 text-white placeholder:text-gray-400 focus:outline-none focus:border-white/40"
          placeholder="Type your answer..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={isGenerating}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="bg-[#19c37d] text-white px-4 py-2 rounded-full hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
