export interface ProvocationCard {
  id: number;
  type: string;
  provocation: string;
  leftPole?: string;
  rightPole?: string;
  hasSlider: boolean;
  nudges?: {
    low: string; // position < 40
    mid: string; // position 40-60
    high: string; // position > 60
  };
  writePlaceholder: string;
  designNote?: string;
}

export const ANORA_CARDS: ProvocationCard[] = [
  {
    id: 1,
    type: "THE TAKE",
    provocation:
      "Sean Baker won Best Picture, Best Director, and Best Screenplay. Letterboxd's most-liked negative review says he failed to make a real character out of his own protagonist. Palme d'Or winner or a first draft that got lucky?",
    leftPole: "Overhyped",
    rightPole: "Deserved every award",
    hasSlider: true,
    nudges: {
      low: "You're disagreeing with Cannes, the Academy, and most working critics. Bold.",
      mid: "Sitting in the middle on this one? That's rarer than you'd think — most people go hard one way or the other.",
      high: "38% of Letterboxd's most-engaged reviewers disagree with you.",
    },
    writePlaceholder: "Why do you think that?",
  },
  {
    id: 2,
    type: "THE SPECIFIC",
    provocation:
      "The car scene. Ani initiates sex with Igor. He tries to kiss her. She slaps him, then collapses crying in his arms. Baker removed all the dialogue from this scene — he wanted it to speak for itself. What did it say to you?",
    leftPole: "She's reclaiming power",
    rightPole: "She's breaking apart",
    hasSlider: true,
    nudges: {
      low: "Baker told IndieWire the sex is about Ani regaining power. You and the director agree.",
      mid: "Most people lean hard one way on this. Baker and Mikey Madison don't even agree with each other on what it means.",
      high: "Mikey Madison said she's curious whether audiences think Ani and Igor end up together. Baker says the scene isn't about Igor at all. The director and his lead read their own ending differently.",
    },
    writePlaceholder: "What did the scene say to you?",
  },
  {
    id: 3,
    type: "THE CONTRARIAN",
    provocation:
      "The strongest case against Anora: every man in the film has clear desires and agency. Ani — the character the film is named after — only exists in reaction to them. She wants Vanya. Then she wants to find Vanya. Then she's exhausted. Where is her interior life?",
    leftPole: "Valid criticism",
    rightPole: "Missing the point entirely",
    hasSlider: true,
    nudges: {
      low: "This take generated more heated replies on Letterboxd than any other review of a 2024 film.",
      mid: "The fact that you can't dismiss it or fully agree — that might be the most honest response.",
      high: "If it's missing the point — what's the point it's missing? That's the harder question.",
    },
    writePlaceholder: "What's your argument?",
    designNote:
      "Most prominent write affordance — this card is designed to provoke writing.",
  },
  {
    id: 4,
    type: "OPEN PROMPT",
    provocation:
      "Anything else sitting with you about Anora? A scene, a feeling, something you can't shake.",
    hasSlider: false,
    writePlaceholder: "The thing the cards didn't ask about...",
  },
];

export function getNudge(
  card: ProvocationCard,
  position: number
): string | null {
  if (!card.nudges) return null;
  if (position < 40) return card.nudges.low;
  if (position <= 60) return card.nudges.mid;
  return card.nudges.high;
}
