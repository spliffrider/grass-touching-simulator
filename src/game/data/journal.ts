import type { GrassTierId, TileTrait, WeatherId } from "../types/game-state";

export const JOURNAL_GRASS_NOTES: Record<GrassTierId, string> = {
  normal: "Reliable. Green. Emotionally available.",
  thick: "More texture, more confidence, slightly more lawn per lawn.",
  clover: "A lucky little patch with excellent social skills.",
  golden: "Suspiciously shiny. Worth documenting twice.",
};

export const JOURNAL_TRAIT_NOTES: Record<TileTrait, string> = {
  normal: "The baseline experience. Respectable underfoot.",
  dewy: "Cool, shiny, and trying very hard to be refreshing.",
  lush: "Peak softness. The field is showing off.",
};

export const JOURNAL_WEATHER_NOTES: Record<WeatherId, string> = {
  calm: "A quiet sky for ordinary touching.",
  dewy_morning: "The field wakes up glittering.",
  warm_sunlight: "Everything stretches a little faster.",
  lucky_breeze: "The air appears to be rooting for you.",
  seed_wind: "Tiny futures are moving through the grass.",
  soft_rain: "A gentle excuse for the lawn to flourish.",
  pollinator_swarm: "Friendly motion, small wings, better odds.",
  golden_hour: "The whole field briefly develops main-character lighting.",
  restless_roots: "The dirt has decided to participate.",
};

export const JOURNAL_COMPANION_NOTES: Record<string, string> = {
  field_mouse: "Small, alert, and apparently unionized.",
  bee_hive: "A buzzing committee for better grass.",
  chicken: "Unclear motives. Excellent field presence.",
  sheep: "Soft automation with snack-based reasoning.",
  meadow_rabbit: "Fast enough to look busy, cute enough to avoid questions.",
  earthworm: "A tiny underground consultant for better regrowth.",
};
