export type RunToolId = "dewPulse" | "rootSalve" | "tinySprinkler" | "pocketSunshine";

export interface RunToolPresentation {
  name: string;
  color: number;
  iconKey: string;
  iconPath: string;
  domTestId: string;
  description: string;
}

export const RUN_TOOL_IDS = ["dewPulse", "rootSalve", "tinySprinkler", "pocketSunshine"] as const satisfies readonly RunToolId[];

export const RUN_TOOL_VIEW: Record<RunToolId, RunToolPresentation> = {
  dewPulse: {
    name: "Dew Pulse",
    color: 0x8fdfff,
    iconKey: "run-tool-dew-pulse",
    iconPath: "/assets/ui/skills/dew-appreciation.png",
    domTestId: "redesign-dew-pulse-button",
    description: "Restore 10 Ancient HP immediately. The healing buys time but earns no replacement RT.",
  },
  rootSalve: {
    name: "Root Salve",
    color: 0xffd26e,
    iconKey: "run-tool-root-salve",
    iconPath: "/assets/ui/skills/root-network.png",
    domTestId: "redesign-root-salve-button",
    description: "Seal one open wound and restore up to 10 Ancient HP.",
  },
  tinySprinkler: {
    name: "Tiny Sprinkler",
    color: 0xbff4ff,
    iconKey: "run-tool-tiny-sprinkler",
    iconPath: "/assets/world/tiny-sprinkler.png",
    domTestId: "redesign-tiny-sprinkler-button",
    description: "Install one run-only sprinkler that automatically tends the field.",
  },
  pocketSunshine: {
    name: "Pocket Sunshine",
    color: 0xffd86b,
    iconKey: "run-tool-pocket-sunshine",
    iconPath: "/assets/ui/items/pocket-sunshine.png",
    domTestId: "redesign-pocket-sunshine-button",
    description: "Crack the jar to push accumulated Scourge pressure back by 0.35. It restores no HP and earns no GT.",
  },
};

export function getEquippedRunToolIds(slotCapacity: number): readonly RunToolId[] {
  return RUN_TOOL_IDS.slice(0, Math.max(0, Math.floor(slotCapacity)));
}
