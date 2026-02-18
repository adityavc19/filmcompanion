'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, SourceName } from '@/types';
import SourceBadge from '@/components/SourceBadge';
import StarterChips from '@/components/StarterChips';

interface Props {
  filmId: number;
  starterChips: string[];
}

export default function ChatInterface({ filmId, starterChips }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    // Optimistically add empty assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '', sources: [] }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId, messages: newMessages }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let sources: SourceName[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        const lines = raw.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              accumulatedText += data.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulatedText,
                  sources: [],
                };
                return updated;
              });
            }
            if (data.done) {
              sources = data.sources ?? [];
            }
            if (data.error) {
              accumulatedText = data.error;
            }
          } catch {
            // Malformed line — skip
          }
        }
      }

      // Finalize with sources
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: accumulatedText,
          sources,
        };
        return updated;
      });
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          sources: [],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, [input]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-cinema-muted font-medium">
          Discuss This Film
        </h2>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-cinema-muted hover:text-white transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Starter chips — show only when no messages yet */}
      {messages.length === 0 && (
        <StarterChips chips={starterChips} onSelect={(chip) => sendMessage(chip)} />
      )}

      {/* Message thread */}
      {messages.length > 0 && (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-cinema-accent/15 border border-cinema-accent/30 text-white'
                    : 'bg-cinema-surface border border-cinema-border text-white/90'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && msg.role === 'assistant' && (
                    <span className="inline-block w-1.5 h-4 bg-cinema-accent/60 animate-pulse ml-0.5 align-middle" />
                  )}
                </p>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && !isStreaming && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-cinema-border/50">
                    {msg.sources.map((src) => (
                      <SourceBadge key={src} source={src} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the film..."
            rows={1}
            disabled={isStreaming}
            className="w-full px-4 py-3 bg-cinema-surface border border-cinema-border rounded-xl text-white placeholder-cinema-muted text-sm focus:outline-none focus:border-cinema-accent/60 focus:ring-1 focus:ring-cinema-accent/30 transition-all resize-none disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-cinema-accent rounded-xl text-cinema-bg font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cinema-accent/90 transition-colors"
        >
          {isStreaming ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </form>
      <p className="text-xs text-cinema-muted/60 text-center">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
