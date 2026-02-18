import type { SentimentSummary } from '@/types';

export default function SentimentSection({ sentiment }: { sentiment: SentimentSummary }) {
  if (!sentiment.critics && !sentiment.audiences) return null;

  return (
    <div className="bg-cinema-surface border border-cinema-border rounded-xl p-5">
      <h2 className="text-xs uppercase tracking-widest text-cinema-muted font-medium mb-4">
        What People Think
      </h2>
      <div className="space-y-4">
        {sentiment.critics && (
          <div className="flex gap-3">
            <div className="w-1 flex-shrink-0 bg-blue-500/60 rounded-full" />
            <div>
              <p className="text-xs text-blue-300/70 uppercase tracking-wider mb-1">Critics</p>
              <p className="text-sm text-white/80 leading-relaxed">{sentiment.critics}</p>
            </div>
          </div>
        )}
        {sentiment.audiences && (
          <div className="flex gap-3">
            <div className="w-1 flex-shrink-0 bg-emerald-500/60 rounded-full" />
            <div>
              <p className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">Audiences</p>
              <p className="text-sm text-white/80 leading-relaxed">{sentiment.audiences}</p>
            </div>
          </div>
        )}
        {sentiment.tension && (
          <div className="flex gap-3">
            <div className="w-1 flex-shrink-0 bg-cinema-accent/60 rounded-full" />
            <div>
              <p className="text-xs text-cinema-accent/70 uppercase tracking-wider mb-1">The Divide</p>
              <p className="text-sm text-white/80 leading-relaxed">{sentiment.tension}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
