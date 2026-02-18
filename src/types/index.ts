export type SourceName = 'tmdb' | 'letterboxd' | 'reddit' | 'rottentomatoes' | 'youtube';

export interface TmdbSearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
}

export interface TmdbFilm {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  runtime: number | null;
  genres: { id: number; name: string }[];
  credits?: {
    cast: { name: string; character: string; order: number }[];
    crew: { name: string; job: string; department: string }[];
  };
}

export interface Chunk {
  id: string;        // `${filmId}-${source}-${index}`
  filmId: number;
  source: SourceName;
  text: string;
  metadata?: Record<string, string | number>;
}

export interface SentimentSummary {
  critics: string;
  audiences: string;
  tension: string;
  letterboxdRating?: string;
  tomatometer?: string;
}

export interface FilmKnowledge {
  filmId: number;
  tmdbData: TmdbFilm;
  chunks: Chunk[];
  sentiment: SentimentSummary;
  starterChips: string[];
  sourcesLoaded: SourceName[];
  ingestedAt: number;
}

export interface IngestProgressEvent {
  source?: SourceName;
  status?: 'loading' | 'done' | 'error';
  count?: number;
  quote?: string;
  error?: string;
  type?: 'complete' | 'ready';
  cached?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceName[];
}
