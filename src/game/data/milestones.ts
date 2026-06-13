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
    requiredLifetimeTouches: 8,
    tilesToAdd: 3,
    message: "The grass is spreading. This may be a good sign.",
  },
  {
    id: "patch_spreads",
    name: "Patch Spreads",
    requiredLifetimeTouches: 28,
    tilesToAdd: 4,
    message: "New patches poke through the dirt in a pleasingly uneven shape.",
  },
  {
    id: "questionable_lawn",
    name: "Questionable Lawn",
    requiredLifetimeTouches: 75,
    tilesToAdd: 6,
    message: "This is almost a lawn. Almost.",
  },
  {
    id: "soft_backyard",
    name: "Soft Backyard Grass",
    requiredLifetimeTouches: 180,
    tilesToAdd: 9,
    message: "The surface softens. Your screen time looks nervous.",
  },
  {
    id: "meadow_starts",
    name: "Meadow Starts",
    requiredLifetimeTouches: 420,
    tilesToAdd: 12,
    message: "The lawn stops pretending to be contained.",
  },
  {
    id: "neighbor_notices",
    name: "Neighbor Notices",
    requiredLifetimeTouches: 820,
    tilesToAdd: 16,
    message: "This much grass has become a local talking point.",
  },
  {
    id: "serious_pasture",
    name: "Serious Pasture",
    requiredLifetimeTouches: 1500,
    tilesToAdd: 24,
    message: "The field pushes outward with absolutely no shame.",
  },
  {
    id: "regional_grass_event",
    name: "Regional Grass Event",
    requiredLifetimeTouches: 3000,
    tilesToAdd: 36,
    message: "The map would like to know what you are doing.",
  },
  {
    id: "horizon_gets_involved",
    name: "Horizon Gets Involved",
    requiredLifetimeTouches: 5400,
    tilesToAdd: 52,
    message: "There is grass in directions that used to be theoretical.",
  },
  {
    id: "grassland_protocol",
    name: "Grassland Protocol",
    requiredLifetimeTouches: 8600,
    tilesToAdd: 74,
    message: "The field is now large enough to have opinions.",
  },
  {
    id: "unreasonable_biome",
    name: "Unreasonable Biome",
    requiredLifetimeTouches: 15000,
    tilesToAdd: 104,
    message: "This is less a lawn and more a lifestyle.",
  },
  {
    id: "continental_touch_zone",
    name: "Continental Touch Zone",
    requiredLifetimeTouches: 26000,
    tilesToAdd: 140,
    message: "Grass spreads past the edge of reasonable UI design.",
  },
  {
    id: "lawn_visible_from_orbit",
    name: "Lawn Visible From Orbit",
    requiredLifetimeTouches: 46000,
    tilesToAdd: 210,
    message: "The field is now a landmark for concerned satellites.",
  },
  {
    id: "outside_has_won",
    name: "Outside Has Won",
    requiredLifetimeTouches: 76000,
    tilesToAdd: 300,
    message: "There may still be a screen here, but outside has won.",
  },
  {
    id: "grass_singularity",
    name: "Grass Singularity",
    requiredLifetimeTouches: 125000,
    tilesToAdd: 420,
    message: "The grass has become the interface.",
  },
];
