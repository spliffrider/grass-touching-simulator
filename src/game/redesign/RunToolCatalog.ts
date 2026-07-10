export type RunToolId = "dewPulse" | "rootSalve" | "tinySprinkler";

export interface RunToolPresentation {
  name: string;
  color: number;
  iconKey: string;
  iconPath: string;
  description: string;
}

export const RUN_TOOL_IDS = ["tinySprinkler", "dewPulse", "rootSalve"] as const satisfies readonly RunToolId[];

export const RUN_TOOL_VIEW: Record<RunToolId, RunToolPresentation> = {
  dewPulse: {
    name: "Dew Pulse",
    color: 0x8fdfff,
    iconKey: "run-tool-dew-pulse",
    iconPath: "/assets/ui/skills/dew-appreciation.png",
    description: "Restore 10 Ancient HP immediately. The healing buys time but earns no replacement RT.",
  },
  rootSalve: {
    name: "Root Salve",
    color: 0xffd26e,
    iconKey: "run-tool-root-salve",
    iconPath: "/assets/ui/skills/root-network.png",
    description: "Seal one open wound and restore up to 10 Ancient HP.",
  },
  tinySprinkler: {
    name: "Tiny Sprinkler",
    color: 0xbff4ff,
    iconKey: "run-tool-tiny-sprinkler",
    iconPath: "/assets/world/tiny-sprinkler.png",
    description: "Install one run-only sprinkler that automatically tends the field.",
  },
};
