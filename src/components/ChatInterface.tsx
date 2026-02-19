'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, SourceName } from '@/types';

const SOURCE_COLORS: Record<string, string> = {
  letterboxd:     '#00C030',
  reddit:         '#FF6B35',
  rottentomatoes: '#E8B74A',
  youtube:        '#FF0000',
  tmdb:           '#888',
};

const SOURCE_LABELS: Record<string, string> = {
  letterboxd:     'Letterboxd',
  reddit:         'Reddit',
  rottentomatoes: 'RT',
  youtube:        'YouTube',
  tmdb:           'TMDB',
};

function SourcePill({ source }: { source: SourceName }) {
  const color = SOURCE_COLORS[source] ?? '#888';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 100,
        fontSize: 11, fontWeight: 500, letterSpacing: '0.02em',
        background: `${color}15`, color, border: `1px solid ${color}25`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#E8B74A', opacity: 0.4,
              animation: `typeDot 1.2s ease ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  filmId: number;
  filmTitle: string;
  starterChips: string[];
}

export default function ChatInterface({ filmId, filmTitle, starterChips }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    // Optimistically add empty assistant message (shows typing indicator)
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

        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              accumulatedText += data.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: accumulatedText, sources: [] };
                return updated;
              });
            }
            if (data.done) sources = data.sources ?? [];
            if (data.error) accumulatedText = data.error;
          } catch { /* skip malformed line */ }
        }
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: accumulatedText, sources };
        return updated;
      });
    } catch {
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

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, [input]);

  const lastMsg = messages[messages.length - 1];
  const showTypingDots = isStreaming && lastMsg?.role === 'assistant' && lastMsg?.content === '';

  return (
    <div style={{ marginTop: 40, borderTop: '1px solid #171715', paddingTop: 36, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'linear-gradient(135deg, #E8B74A20, #E8B74A08)',
              border: '1px solid #E8B74A25',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10,
            }}
          >
            ✦
          </div>
          <span style={{ fontSize: 15, fontFamily: 'var(--font-instrument), Georgia, serif', color: '#F0EDE6' }}>
            Discuss <span style={{ fontStyle: 'italic', color: '#AAA8A0' }}>{filmTitle}</span>
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ background: 'none', border: 'none', fontSize: 11, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Empty state: starter chips */}
      {messages.length === 0 && starterChips.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
            Ask anything about the film.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {starterChips.map((chip) => (
              <ChipButton key={chip} label={chip} onClick={() => sendMessage(chip)} />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 24 }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isLast = i === messages.length - 1;
            const isEmpty = msg.content === '' && isStreaming && isLast && !isUser;

            return (
              <div
                key={i}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  gap: 8,
                  animation: isLast ? 'msgFade 0.35s ease' : 'none',
                }}
              >
                {/* Companion label */}
                {!isUser && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: 'linear-gradient(135deg, #E8B74A22, #E8B74A08)',
                        border: '1px solid #E8B74A25',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10,
                      }}
                    >
                      ✦
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#777' }}>
                      Companion
                    </span>
                  </div>
                )}

                {/* Bubble / text */}
                {isEmpty ? (
                  <TypingIndicator />
                ) : (
                  <div
                    style={
                      isUser
                        ? {
                            maxWidth: '80%',
                            padding: '12px 18px',
                            background: '#1A1816',
                            borderRadius: '14px 14px 4px 14px',
                            border: '1px solid #2A2820',
                          }
                        : { paddingLeft: 30, width: '100%' }
                    }
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.8,
                        color: isUser ? '#F0EDE6' : '#B8B5AC',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                      {/* Streaming cursor */}
                      {isStreaming && isLast && !isUser && msg.content !== '' && (
                        <span
                          style={{
                            display: 'inline-block', width: 6, height: 16,
                            background: 'rgba(232,183,74,0.6)',
                            marginLeft: 2, verticalAlign: 'middle',
                            animation: 'typeDot 1s ease infinite',
                          }}
                        />
                      )}
                    </p>
                  </div>
                )}

                {/* Source pills */}
                {!isUser && msg.sources && msg.sources.length > 0 && !isStreaming && (
                  <div style={{ display: 'flex', gap: 6, paddingLeft: 30, flexWrap: 'wrap' }}>
                    {msg.sources.map((s) => <SourcePill key={s} source={s} />)}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          padding: '14px 18px',
          background: '#0F0F0E',
          borderRadius: 12,
          border: '1px solid #1C1C1A',
          transition: 'border-color 0.2s',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder={`Ask about ${filmTitle}...`}
          rows={1}
          disabled={isStreaming}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: 14,
            lineHeight: 1.5,
            color: '#F0EDE6',
            fontFamily: 'inherit',
            opacity: isStreaming ? 0.5 : 1,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
          style={{
            width: 34, height: 34, borderRadius: 8, border: 'none',
            background: input.trim() && !isStreaming ? '#E8B74A' : '#1A1A18',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke={input.trim() && !isStreaming ? '#0C0C0B' : '#444'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Extracted to avoid inline hover workaround — uses CSS via onMouse* since Tailwind isn't used here
function ChipButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#1A1816' : '#13130F',
        border: `1px solid ${hovered ? '#E8B74A30' : '#222218'}`,
        borderRadius: 10,
        padding: '11px 16px',
        color: hovered ? '#F0EDE6' : '#999890',
        fontFamily: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        lineHeight: 1.4,
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}
