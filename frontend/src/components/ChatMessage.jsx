// frontend/src/components/ChatMessage.jsx

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { RefreshCw, Copy, Lightbulb } from 'lucide-react';
import Avatar from './Avatar.jsx';

export function ChatMessage({ message, onCopy, onRegenerate }) {
  const isUser = message.role === 'user';
  const [showThinking, setShowThinking] = React.useState(false);

  const containerClass = `flex items-start gap-3 my-4 ${isUser ? 'justify-end' : ''}`;
  const bubbleClass = isUser 
    ? 'ml-auto inline-block max-w-[75%] rounded-2xl px-4 py-3 text-sm font-medium text-white bg-gradient-to-br from-green-600 to-emerald-600 shadow-md'
    : 'w-full max-w-[720px] rounded-2xl px-5 py-4 text-sm bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg';

  return (
    <div className={containerClass}>
      {!isUser && <Avatar role={message.role} />}
      <div className="flex flex-col w-full max-w-[720px]">
        <div className={bubbleClass}>
          <div className="prose prose-invert prose-p:my-1 prose-headings:my-2 break-words">
            <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
          </div>
        </div>
        {!isUser && (
          <div className="mt-2 flex items-center gap-2">
            <button onClick={onRegenerate} title="Regenerate response" className="h-7 w-7 rounded-md bg-white/10 border border-white/10 grid place-items-center text-white/80 hover:bg-white/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onCopy(String(message.content ?? ''))} title="Copy text" className="h-7 w-7 rounded-md bg-white/10 border border-white/10 grid place-items-center text-white/80 hover:bg-white/20 transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
            {message.contextUsed && (
               <button
                  onClick={() => setShowThinking(v => !v)}
                  title={showThinking ? 'Hide thinking' : 'Show thinking'}
                  className="h-7 rounded-md px-2 bg-white/10 border border-white/10 text-white/80 hover:bg-white/20 flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5" /> {showThinking ? 'Hide' : 'Info'}
                </button>
            )}
          </div>
        )}
        {showThinking && message.contextUsed && (
            <div className="mt-2 rounded-xl bg-black/50 border border-white/10 p-3 text-xs text-white/80">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed opacity-90">{JSON.stringify(message.contextUsed, null, 2)}</pre>
            </div>
        )}
      </div>
    </div>
  );
};
