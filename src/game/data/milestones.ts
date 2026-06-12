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
    requiredLifetimeTouches: 15,
    tilesToAdd: 2,
    message: "The grass is spreading. This may be a good sign.",
  },
  {
    id: "patch_spreads",
    name: "Patch Spreads",
    requiredLifetimeTouches: 55,
    tilesToAdd: 3,
    message: "New patches poke through the dirt in a pleasingly uneven shape.",
  },
  {
    id: "questionable_lawn",
    name: "Questionable Lawn",
    requiredLifetimeTouches: 140,
    tilesToAdd: 5,
    message: "This is almost a lawn. Almost.",
  },
  {
    id: "soft_backyard",
    name: "Soft Backyard Grass",
    requiredLifetimeTouches: 320,
    tilesToAdd: 7,
    message: "The surface softens. Your screen time looks nervous.",
  },
  {
    id: "meadow_starts",
    name: "Meadow Starts",
    requiredLifetimeTouches: 700,
    tilesToAdd: 10,
    message: "The lawn stops pretending to be contained.",
  },
  {
    id: "neighbor_notices",
    name: "Neighbor Notices",
    requiredLifetimeTouches: 1200,
    tilesToAdd: 14,
    message: "This much grass has become a local talking point.",
  },
  {
    id: "serious_pasture",
    name: "Serious Pasture",
    requiredLifetimeTouches: 2200,
    tilesToAdd: 20,
    message: "The field pushes outward with absolutely no shame.",
  },
  {
    id: "regional_grass_event",
    name: "Regional Grass Event",
    requiredLifetimeTouches: 4200,
    tilesToAdd: 30,
    message: "The map would like to know what you are doing.",
  },
  {
    id: "horizon_gets_involved",
    name: "Horizon Gets Involved",
    requiredLifetimeTouches: 7200,
    tilesToAdd: 44,
    message: "There is grass in directions that used to be theoretical.",
  },
  {
    id: "grassland_protocol",
    name: "Grassland Protocol",
    requiredLifetimeTouches: 11000,
    tilesToAdd: 64,
    message: "The field is now large enough to have opinions.",
  },
  {
    id: "unreasonable_biome",
    name: "Unreasonable Biome",
    requiredLifetimeTouches: 19000,
    tilesToAdd: 90,
    message: "This is less a lawn and more a lifestyle.",
  },
  {
    id: "continental_touch_zone",
    name: "Continental Touch Zone",
    requiredLifetimeTouches: 32000,
    tilesToAdd: 120,
    message: "Grass spreads past the edge of reasonable UI design.",
  },
  {
    id: "lawn_visible_from_orbit",
    name: "Lawn Visible From Orbit",
    requiredLifetimeTouches: 56000,
    tilesToAdd: 180,
    message: "The field is now a landmark for concerned satellites.",
  },
  {
    id: "outside_has_won",
    name: "Outside Has Won",
    requiredLifetimeTouches: 90000,
    tilesToAdd: 260,
    message: "There may still be a screen here, but outside has won.",
  },
  {
    id: "grass_singularity",
    name: "Grass Singularity",
    requiredLifetimeTouches: 150000,
    tilesToAdd: 360,
    message: "The grass has become the interface.",
  },
];
