export interface ProvocationCard {
  id: number;
  type: string;
  provocation: string;
  leftPole?: string;
  rightPole?: string;
  hasSlider: boolean;
  nudges?: {
    low: string;
    mid: string;
    high: string;
  };
  writePlaceholder: string;
}

export interface FilmProvocations {
  hookText: string;
  dataPoint: string;
  cards: ProvocationCard[];
}

export function getNudge(
  card: ProvocationCard,
  position: number
): string | null {
  if (!card.nudges) return null;
  if (position < 40) return card.nudges.low;
  if (position <= 60) return card.nudges.mid;
  return card.nudges.high;
}
