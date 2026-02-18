import type { SourceName } from '@/types';

const SOURCE_CONFIG: Record<SourceName, { label: string; color: string }> = {
  tmdb: { label: 'TMDB', color: 'bg-blue-900/50 text-blue-300 border-blue-700/50' },
  letterboxd: { label: 'Letterboxd', color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' },
  reddit: { label: 'Reddit', color: 'bg-orange-900/50 text-orange-300 border-orange-700/50' },
  rottentomatoes: { label: 'Rotten Tomatoes', color: 'bg-red-900/50 text-red-300 border-red-700/50' },
  youtube: { label: 'YouTube Essay', color: 'bg-purple-900/50 text-purple-300 border-purple-700/50' },
};

export default function SourceBadge({ source }: { source: SourceName }) {
  const config = SOURCE_CONFIG[source] ?? { label: source, color: 'bg-gray-800 text-gray-400 border-gray-600' };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.color}`}
    >
      {config.label}
    </span>
  );
}
