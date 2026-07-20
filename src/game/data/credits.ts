export const PLAYTESTER_CREDITS = [
  "Cosmodeus",
  "Remy",
  "Robin C.",
  "TuloWodash",
  "VNDYN",
  "tussukarva🇫🇮🇸🇪",
  "🔪⋆🎀  𝒦𝒾𝓉𝓉𝓎 𝒩💔𝒾𝓇 🎀⋆🔪",
] as const;

export const GRASS_TOUCHER_CREDITS = [
  "Sad choupbese",
  "KaviaarSocialist",
  "Echarnus",
  "Overtilted",
  "entry 3 test",
] as const;

export const CREDIT_DEVELOPER = "sensiburner";

export const CREDITS_ACCESSIBLE_COPY = [
  `Created by ${CREDIT_DEVELOPER}.`,
  `Playtesters: ${PLAYTESTER_CREDITS.join(", ")}.`,
  `Grass Touchers: ${GRASS_TOUCHER_CREDITS.join(", ")}.`,
].join(" ");
