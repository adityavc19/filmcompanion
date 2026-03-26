/**
 * Template-based opening message generation.
 * Finds tension between the user's positions, not just summarizes them.
 * 6 variants from the spec + 1 default.
 */
export function generateOpener(positions: number[]): string {
  const [card1, card2, card3] = positions;

  // Card 1 > 60 AND Card 3 < 40 (loved the film but agrees Ani is underwritten)
  if (card1 > 60 && card3 >= 0 && card3 < 40) {
    return "You think Anora deserved every award — but you also think Baker undercooked his protagonist. That's a fascinating tension. Can a film win Best Picture on vibes and performance alone, without fully earning its main character?";
  }

  // Card 1 < 40 AND Card 2 < 40 (didn't love it but reads ending as empowering)
  if (card1 >= 0 && card1 < 40 && card2 >= 0 && card2 < 40) {
    return "You're not sold on the film overall, but you read the ending as Ani reclaiming power. So Baker stuck the landing even if the flight was bumpy? Or is the ending good *despite* the film around it?";
  }

  // Card 2 > 60 AND Card 3 > 60 (reads ending as devastation, thinks interiority critique misses the point)
  if (card2 > 60 && card3 > 60) {
    return "You think Ani is breaking apart in that car — and that the film fully earns it. The Letterboxd critique says she has no interior life. Your counter-argument seems to be: the breaking apart IS the interior life finally surfacing. Am I reading you right?";
  }

  // Card 1 > 60 AND Card 2 > 60 AND Card 3 > 60 (all-in defender)
  if (card1 > 60 && card2 > 60 && card3 > 60) {
    return "You're all in on this film. So here's the harder question — is there anything Baker could have done better? Or is Anora the rare case where the messiness is the point?";
  }

  // Card 1 < 40 AND Card 2 > 60 AND Card 3 < 40 (harsh on everything)
  if (
    card1 >= 0 &&
    card1 < 40 &&
    card2 > 60 &&
    card3 >= 0 &&
    card3 < 40
  ) {
    return "Sounds like Anora left you cold across the board. Most people who feel that way still concede Mikey Madison's performance. What's the single moment — if any — where the film got close to working for you?";
  }

  // Card 1 > 60 (generally positive)
  if (card1 > 60) {
    return "You lean toward Anora deserving its accolades. But the discourse isn't going away — Letterboxd's most-engaged users are still fighting about it. What's the one thing even defenders should concede?";
  }

  // Default (no clear pattern)
  return "Your positions are all over the place — and that might be the most honest response to this film. Anora resists clean takes. What's the one thing about it that you're still turning over?";
}
