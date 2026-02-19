'use client';

import { useState } from 'react';
import type { SentimentSummary } from '@/types';

interface Props {
  sentiment: SentimentSummary;
  sourcesLoaded: string[];
  chunkCount: number;
}

const SOURCE_META: Record<string, { icon: string; name: string; color: string }> = {
  letterboxd:     { icon: '📗', name: 'Letterboxd',     color: '#00C030' },
  reddit:         { icon: '💬', name: 'Reddit',         color: '#FF6B35' },
  rottentomatoes: { icon: '🍅', name: 'Rotten Tomatoes', color: '#E8B74A' },
  youtube:        { icon: '▶',  name: 'YouTube',        color: '#FF0000' },
};

export default function SentimentSection({ sentiment, sourcesLoaded, chunkCount }: Props) {
  const [tensionExpanded, setTensionExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  if (!sentiment.critics && !sentiment.audiences && !sentiment.tension) return null;

  const loadedSources = Object.entries(SOURCE_META).filter(([key]) => sourcesLoaded.includes(key));

  return (
    <div>
      {/* Section header */}
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555' }}>
        What People Think
      </p>

      {/* Critics / Audiences cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
        {sentiment.critics && (
          <div style={{ padding: '20px 22px', background: '#0F0F0E', borderRadius: 10, border: '1px solid #1A1A18' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00C030', marginBottom: 10 }}>
              Critics
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#999890', margin: 0 }}>{sentiment.critics}</p>
          </div>
        )}
        {sentiment.audiences && (
          <div style={{ padding: '20px 22px', background: '#0F0F0E', borderRadius: 10, border: '1px solid #1A1A18' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FF6B35', marginBottom: 10 }}>
              Audiences
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#999890', margin: 0 }}>{sentiment.audiences}</p>
          </div>
        )}
      </div>

      {/* Where the Debate Lives */}
      {sentiment.tension && (
        <div style={{ marginTop: 28 }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555' }}>
            Where the Debate Lives
          </p>
          <div
            onClick={() => setTensionExpanded(!tensionExpanded)}
            style={{
              marginTop: 14,
              background: tensionExpanded ? '#161614' : '#111110',
              border: `1px solid ${tensionExpanded ? '#2A2820' : '#1C1C1A'}`,
              borderRadius: 12,
              padding: '18px 22px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#E8B74A', flexShrink: 0,
                    opacity: tensionExpanded ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                  }}
                />
                <h4
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontFamily: 'var(--font-instrument), Georgia, serif',
                    color: tensionExpanded ? '#F0EDE6' : '#AAA8A0',
                    fontWeight: 400,
                    transition: 'color 0.2s',
                  }}
                >
                  The Divide
                </h4>
              </div>
              <svg
                width="14" height="14" viewBox="0 0 16 16" fill="none"
                style={{
                  transform: tensionExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s ease',
                  flexShrink: 0,
                }}
              >
                <path d="M4 6l4 4 4-4" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {tensionExpanded && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1C1C1A' }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: '#999890' }}>
                  {sentiment.tension}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sources breakdown */}
      {(loadedSources.length > 0 || chunkCount > 0) && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setSourcesExpanded(!sourcesExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '12px 16px',
              background: '#0F0F0E',
              border: '1px solid #1A1A18',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 12, color: '#777', fontFamily: 'inherit' }}>
              Based on {chunkCount} knowledge chunks
            </span>
            <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
              {loadedSources.map(([key, s]) => (
                <span key={key} style={{ fontSize: 11, opacity: 0.6 }}>{s.icon}</span>
              ))}
            </div>
            <svg
              width="12" height="12" viewBox="0 0 16 16" fill="none"
              style={{
                marginLeft: 'auto',
                transform: sourcesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease',
              }}
            >
              <path d="M4 6l4 4 4-4" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {sourcesExpanded && (
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, animation: 'fadeUp 0.3s ease' }}
            >
              {loadedSources.map(([key, s]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', background: '#0F0F0E',
                    borderRadius: 8, border: '1px solid #1A1A18',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#BBB', fontWeight: 500 }}>{s.name}</div>
                  </div>
                  <span style={{ fontSize: 11, color: s.color, fontWeight: 600, flexShrink: 0, opacity: 0.8 }}>
                    loaded
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
