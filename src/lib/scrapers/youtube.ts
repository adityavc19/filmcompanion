import { spawn } from 'child_process';
import { readFile, unlink, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

async function findYtDlp(): Promise<string | null> {
  const candidates = [
    '/opt/homebrew/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    'yt-dlp',
  ];

  for (const candidate of candidates) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(candidate, ['--version'], { stdio: 'ignore' });
        proc.on('error', reject);
        proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
      });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function parseVtt(vttContent: string): string {
  const lines = vttContent.split('\n');
  const textLines: string[] = [];
  let prevLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip WEBVTT header, timestamps, position tags, and empty lines
    if (
      !trimmed ||
      trimmed === 'WEBVTT' ||
      trimmed.startsWith('NOTE') ||
      /^\d+$/.test(trimmed) ||
      /-->/i.test(trimmed) ||
      /^<\d/.test(trimmed)
    ) {
      continue;
    }
    // Strip inline HTML/VTT tags
    const cleaned = trimmed.replace(/<[^>]+>/g, '').trim();
    if (!cleaned || cleaned === prevLine) continue;
    textLines.push(cleaned);
    prevLine = cleaned;
  }

  // Join and clean up
  return textLines.join(' ').replace(/\s{2,}/g, ' ').trim();
}

async function runYtDlp(ytdlp: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlp, args);
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(-200)}`));
    });
  });
}

export async function scrapeYoutube(filmId: number, film: TmdbFilm): Promise<Chunk[]> {
  const ytdlp = await findYtDlp();
  if (!ytdlp) {
    console.log('YouTube: yt-dlp not found, skipping');
    return [];
  }

  const year = getFilmYear(film);
  const query = `${film.title} ${year} video essay`;
  const tmpPrefix = join(tmpdir(), `fc_yt_${filmId}_`);

  try {
    // Download auto-captions for top 2 search results
    await runYtDlp(ytdlp, [
      '--write-auto-sub',
      '--sub-lang', 'en',
      '--skip-download',
      '--no-playlist',
      '--max-downloads', '2',
      '--match-filter', 'duration < 2400',  // Under 40 min
      '--output', `${tmpPrefix}%(id)s`,
      `ytsearch2:${query}`,
    ]);

    // Find generated .vtt files
    const tmpDir = tmpdir();
    const files = await readdir(tmpDir);
    const vttFiles = files
      .filter((f) => f.startsWith(`fc_yt_${filmId}_`) && f.endsWith('.vtt'))
      .map((f) => join(tmpDir, f));

    if (!vttFiles.length) return [];

    const transcripts: string[] = [];
    for (const vttFile of vttFiles) {
      try {
        const content = await readFile(vttFile, 'utf-8');
        const parsed = parseVtt(content);
        if (parsed.length > 100) transcripts.push(parsed);
        await unlink(vttFile).catch(() => {});
      } catch {
        continue;
      }
    }

    if (!transcripts.length) return [];

    const combined = transcripts.join('\n\n---\n\n');
    // Limit to 20 chunks from YouTube to avoid overwhelming other sources
    return chunkText(combined, filmId, 'youtube').slice(0, 20);
  } catch (err) {
    console.warn('YouTube scrape failed:', err);
    return [];
  }
}
