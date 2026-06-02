export interface MilestoneDefinition {
  id: string;
  name: string;
  requiredLifetimeTouches: number;
  tilesToAdd: number;
  message: string;
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    id: "first_sprouts",
    name: "First Sprouts",
    requiredLifetimeTouches: 10,
    tilesToAdd: 2,
    message: "The grass is spreading. This may be a good sign.",
  },
  {
    id: "patch_spreads",
    name: "Patch Spreads",
    requiredLifetimeTouches: 35,
    tilesToAdd: 3,
    message: "New patches poke through the dirt in a pleasingly uneven shape.",
  },
  {
    id: "questionable_lawn",
    name: "Questionable Lawn",
    requiredLifetimeTouches: 90,
    tilesToAdd: 5,
    message: "This is almost a lawn. Almost.",
  },
  {
    id: "soft_backyard",
    name: "Soft Backyard Grass",
    requiredLifetimeTouches: 180,
    tilesToAdd: 7,
    message: "The surface softens. Your screen time looks nervous.",
  },
];
