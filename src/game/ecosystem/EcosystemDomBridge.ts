import { HELPER_IDS, HELPERS, PRODUCTION_RESOURCE_IDS, PRODUCTION_RESOURCES, TILE_STAGE_COUNT, TileStage, type HelperId } from "./EcosystemCatalog";
import {
  canBeginNextEcosystemRun,
  getCultivationCost,
  getDominantChunkStage,
  getFirstAutomationStatus,
  getHelperPurchaseCost,
  getHelperUnlockCost,
  getModeUnlockCost,
  getPermanentRankCost,
  getTouchRankCost,
  isFirstCollapseAwaitingSprinkler,
  isFirstEcosystemCollapse,
  isRunEquipmentAvailable,
  type EcosystemState,
  type FirstAutomationStatus,
  type PermanentEcosystemState,
  type PermanentRankKind,
  type PermanentTouchRankKind,
} from "./EcosystemSystem";

export interface EcosystemDomActions {
  touchCoordinates(x: number, y: number): void;
  buyHelper(helperId: HelperId): void;
  switchMode(helperId: HelperId, modeId: string): void;
  buyCultivation(): void;
  toggleWorks(): void;
  toggleOptions(): void;
  beginNextRun(): void;
  unlockHelper(helperId: HelperId): void;
  unlockMode(helperId: HelperId, modeId: string): void;
  buyRank(helperId: HelperId, kind: PermanentRankKind): void;
  unlockFieldTier(): void;
  buyTouchRank(kind: PermanentTouchRankKind): void;
  buyFieldEmbrace(): void;
  addPrototypeCurrency(): void;
  forceGameOver(): void;
  setPrototypeField(size: number): void;
  unlockPrototype(): void;
  resetPrototypeSave(): void;
}

interface DynamicButton {
  element: HTMLButtonElement;
  helperId?: HelperId;
  modeId?: string;
  rankKind?: PermanentRankKind;
  touchKind?: PermanentTouchRankKind;
}

const TILE_STAGE_DOM_LABELS = ["dormant", "dewy", "moist", "sprouting", "verdant", "flowering", "pollinated", "rooted"] as const;

function getAutomationReadableLine(status: FirstAutomationStatus): string | null {
  switch (status.stage) {
    case "locked":
      return null;
    case "gather":
      return `First automation: ${Math.floor(status.purchaseProgress * status.purchaseCost)} / ${status.purchaseCost} RT toward Tiny Sprinkler`;
    case "ready":
      return `First automation ready: buy Tiny Sprinkler for ${status.purchaseCost} RT`;
    case "firstCycle":
      return `First sprinkler cycle: Dew is becoming Moisture and Care, cycle ${Math.floor(status.cycleProgress * 100)}%`;
    case "sustain":
      return `Care online: keep Tiny Sprinkler supplied; ${status.dewAmount.toFixed(1)} Dew available, cycle ${Math.floor(status.cycleProgress * 100)}%`;
    case "dry":
      return "Tiny Sprinkler dry: touch the field to gather Dew";
    case "paused":
      return `Tiny Sprinkler paused: ${status.pauseReason ?? "check its buffers"}`;
  }
}

export class EcosystemDomBridge {
  private readonly root: HTMLDivElement;
  private readonly readable: HTMLOutputElement;
  private readonly xInput: HTMLInputElement;
  private readonly yInput: HTMLInputElement;
  private readonly buyButtons: DynamicButton[] = [];
  private readonly modeButtons: DynamicButton[] = [];
  private readonly memoryButtons: DynamicButton[] = [];
  private readonly cultivateButton: HTMLButtonElement;
  private readonly worksButton: HTMLButtonElement;
  private readonly optionsButton: HTMLButtonElement;
  private readonly nextRunButton: HTMLButtonElement;
  private readonly playtestStatus?: HTMLOutputElement;
  private semanticControlIndex = 0;

  constructor(private readonly actions: EcosystemDomActions, playtest: boolean, showPlaytestPanel = false) {
    this.root = document.createElement("div");
    this.root.className = "ecosystem-agent-layer";
    this.root.dataset.testid = "ecosystem-agent-layer";
    this.root.setAttribute("aria-label", "Ecosystem prototype controls");

    this.readable = document.createElement("output");
    this.readable.className = "ecosystem-agent-readable";
    this.readable.dataset.testid = "ecosystem-readable-state";
    this.readable.setAttribute("aria-live", "polite");
    this.root.append(this.readable);

    const controls = document.createElement("section");
    controls.className = "ecosystem-agent-controls";
    controls.setAttribute("aria-label", "Field and factory controls");
    this.xInput = this.createCoordinateInput("Tile X", "ecosystem-tile-x");
    this.yInput = this.createCoordinateInput("Tile Y", "ecosystem-tile-y");
    controls.append(this.xInput, this.yInput);
    controls.append(this.createButton("Touch coordinates", () => {
      this.actions.touchCoordinates(Number(this.xInput.value), Number(this.yInput.value));
    }, "ecosystem-touch-coordinates"));
    this.cultivateButton = this.createButton("Buy Cultivation", () => this.actions.buyCultivation(), "ecosystem-cultivate");
    this.worksButton = this.createButton("Open Ecosystem Works", () => this.actions.toggleWorks(), "ecosystem-toggle-works");
    this.optionsButton = this.createButton("Open Options", () => this.actions.toggleOptions(), "ecosystem-toggle-options");
    this.nextRunButton = this.createButton("Begin next run", () => this.actions.beginNextRun(), "ecosystem-next-run");
    controls.append(this.cultivateButton, this.worksButton, this.optionsButton, this.nextRunButton);

    for (const helperId of HELPER_IDS) {
      const buyButton = this.createButton(`Buy ${HELPERS[helperId].label}`, () => this.actions.buyHelper(helperId), `ecosystem-buy-${helperId}`);
      this.buyButtons.push({ element: buyButton, helperId });
      controls.append(buyButton);
      for (const mode of HELPERS[helperId].modes) {
        const modeButton = this.createButton(
          `Set ${HELPERS[helperId].label} mode to ${mode.label}`,
          () => this.actions.switchMode(helperId, mode.id),
          `ecosystem-mode-${helperId}-${mode.id}`,
        );
        this.modeButtons.push({ element: modeButton, helperId, modeId: mode.id });
        controls.append(modeButton);
      }
    }
    this.root.append(controls);

    const memories = document.createElement("section");
    memories.className = "ecosystem-agent-controls";
    memories.setAttribute("aria-label", "Permanent Memory controls");
    for (const helperId of HELPER_IDS) {
      const unlockButton = this.createButton(
        `Unlock ${HELPERS[helperId].label}`,
        () => this.actions.unlockHelper(helperId),
        `ecosystem-unlock-${helperId}`,
      );
      this.memoryButtons.push({ element: unlockButton, helperId });
      memories.append(unlockButton);
      const alternateMode = HELPERS[helperId].modes[1];
      const modeButton = this.createButton(
        `Unlock ${alternateMode.label} mode`,
        () => this.actions.unlockMode(helperId, alternateMode.id),
        `ecosystem-unlock-mode-${helperId}`,
      );
      this.memoryButtons.push({ element: modeButton, helperId, modeId: alternateMode.id });
      memories.append(modeButton);
      for (const kind of ["throughput", "storage", "efficiency", "startingStock"] as const) {
        const rankButton = this.createButton(
          `Buy ${HELPERS[helperId].label} ${kind} rank`,
          () => this.actions.buyRank(helperId, kind),
          `ecosystem-rank-${helperId}-${kind}`,
        );
        this.memoryButtons.push({ element: rankButton, helperId, rankKind: kind });
        memories.append(rankButton);
      }
    }
    const touchButtons = ([
      ["fastTouch", "Fast Touch", "ecosystem-rank-fast-touch"],
      ["broadPalm", "Broad Palm", "ecosystem-rank-broad-palm"],
      ["manyHands", "Many Hands", "ecosystem-rank-many-hands"],
    ] as const).map(([touchKind, label, testId]) => {
      const element = this.createButton(`Buy ${label} rank`, () => this.actions.buyTouchRank(touchKind), testId);
      this.memoryButtons.push({ element, touchKind });
      return element;
    });
    memories.append(
      this.createButton("Unlock next field size", () => this.actions.unlockFieldTier(), "ecosystem-unlock-field"),
      ...touchButtons,
      this.createButton("Unlock Field Embrace", () => this.actions.buyFieldEmbrace(), "ecosystem-unlock-field-embrace"),
    );
    this.root.append(memories);

    if (playtest) {
      const panel = document.createElement("section");
      panel.className = showPlaytestPanel ? "ecosystem-playtest-panel" : "ecosystem-agent-controls";
      panel.setAttribute("aria-label", "Ecosystem playtest controls");
      this.playtestStatus = document.createElement("output");
      this.playtestStatus.className = showPlaytestPanel ? "ecosystem-playtest-status" : "ecosystem-agent-readable";
      const buttonClass = showPlaytestPanel ? "ecosystem-playtest-button" : "";
      panel.append(
        this.playtestStatus,
        this.createButton("+250 GT and RT", () => this.actions.addPrototypeCurrency(), "ecosystem-debug-currency", buttonClass),
        this.createButton("Unlock all", () => this.actions.unlockPrototype(), "ecosystem-debug-unlock", buttonClass),
        this.createButton("Toggle Works", () => this.actions.toggleWorks(), "ecosystem-debug-works", buttonClass),
        this.createButton("Begin next run", () => this.actions.beginNextRun(), "ecosystem-debug-next-run", buttonClass),
        this.createButton("32x32", () => this.actions.setPrototypeField(32), "ecosystem-debug-field-32", buttonClass),
        this.createButton("50x50", () => this.actions.setPrototypeField(50), "ecosystem-debug-field-50", buttonClass),
        this.createButton("100x100", () => this.actions.setPrototypeField(100), "ecosystem-debug-field-100", buttonClass),
        this.createButton("Force Game Over", () => this.actions.forceGameOver(), "ecosystem-debug-game-over", buttonClass),
        this.createButton("Reset prototype", () => this.actions.resetPrototypeSave(), "ecosystem-debug-reset", buttonClass),
      );
      this.root.append(panel);
    }

    document.body.append(this.root);
    document.documentElement.dataset.grassEcosystemDom = "ready";
  }

  update(state: EcosystemState, permanent: PermanentEcosystemState, worksOpen: boolean, optionsOpen: boolean): void {
    const dominantChunks = Array.from({ length: TILE_STAGE_COUNT }, () => 0);
    for (let chunkIndex = 0; chunkIndex < state.field.dirtyChunks.length; chunkIndex += 1) {
      dominantChunks[getDominantChunkStage(state.field, chunkIndex) as TileStage] += 1;
    }
    const chunkSummary = dominantChunks
      .map((count, stage) => count > 0 ? `${count} ${TILE_STAGE_DOM_LABELS[stage]}` : "")
      .filter(Boolean)
      .join(", ");
    const tinySprinkler = state.helpers.tinySprinkler;
    const firstSprinklerCost = getHelperPurchaseCost(state, "tinySprinkler");
    const firstAutomation = getFirstAutomationStatus(state, permanent);
    const automationLine = getAutomationReadableLine(firstAutomation);
    const firstCollapse = isFirstEcosystemCollapse(state, permanent);
    const firstMemoryPending = isFirstCollapseAwaitingSprinkler(state, permanent);
    const equipmentAvailable = isRunEquipmentAvailable(state);
    const worksAvailable = equipmentAvailable && permanent.unlockedHelpers.tinySprinkler;
    const lines = [
      `Ecosystem prototype | Run ${state.runNumber} | ${state.active ? "active" : "Game Over"}`,
      ...(firstCollapse
        ? [firstMemoryPending
          ? "First collapse complete: remember Tiny Sprinkler before beginning Run 2"
          : "First memory complete: Run 2 can now build Care automation"]
        : []),
      `Ancient HP ${state.hp.toFixed(1)} / ${state.maxHp.toFixed(0)}`,
      `Scourge demand ${state.scourgeDemandPerSecond.toFixed(2)} Care/s | Care production ${state.rates.care.toFixed(2)}/s`,
      `Field ${state.field.width}x${state.field.height} | Cultivation ${state.field.cultivationRank}/10 | RT ${state.runTouches.toFixed(1)} | GT ${permanent.grassTouches.toFixed(0)}`,
      ...(automationLine ? [automationLine] : []),
      `Bottleneck: ${state.bottleneck}`,
      `Chunks: ${state.field.dirtyChunks.length} total; ${chunkSummary}`,
      "Stocks:",
      ...PRODUCTION_RESOURCE_IDS.map((resourceId) => {
        const buffer = state.resources[resourceId];
        return `${PRODUCTION_RESOURCES[resourceId].label}: ${buffer.amount.toFixed(1)}/${buffer.capacity.toFixed(1)} (+${state.rates[resourceId].toFixed(2)}/s)`;
      }),
      ...(equipmentAvailable
        ? [
          "Helpers:",
          ...HELPER_IDS.filter((helperId) => permanent.unlockedHelpers[helperId]).map((helperId) => {
            const helper = state.helpers[helperId];
            return `${HELPERS[helperId].label}: ${helper.count}, ${helper.modeId}${helper.lastPauseReason ? `, ${helper.lastPauseReason}` : ""}`;
          }),
        ]
        : ["Equipment: unavailable during Run 1"]),
    ];
    this.setOutput(this.readable, lines.join("\n"));
    this.setInputMax(this.xInput, `${Math.max(0, state.field.width - 1)}`);
    this.setInputMax(this.yInput, `${Math.max(0, state.field.height - 1)}`);
    this.setDisabled(this.cultivateButton, !state.active || state.resources.growth.amount < getCultivationCost(state));
    this.setText(this.cultivateButton, `Buy Cultivation ${Math.min(10, state.field.cultivationRank + 1)}/10 for ${getCultivationCost(state)} Growth`);
    this.setText(this.worksButton, worksOpen ? "Close Ecosystem Works" : "Open Ecosystem Works");
    this.setHidden(this.worksButton, !worksAvailable);
    this.setDisabled(this.worksButton, !worksAvailable);
    this.setText(this.optionsButton, optionsOpen ? "Close Options" : "Open Options");
    this.setText(this.nextRunButton, firstMemoryPending
      ? "Remember Tiny Sprinkler first"
      : firstCollapse
        ? "Begin Run 2"
        : "Begin next run");
    this.setDisabled(this.nextRunButton, !canBeginNextEcosystemRun(state, permanent));

    for (const button of this.buyButtons) {
      const helperId = button.helperId!;
      const unlocked = permanent.unlockedHelpers[helperId];
      const cost = getHelperPurchaseCost(state, helperId);
      this.setHidden(button.element, !equipmentAvailable || !unlocked);
      this.setDisabled(button.element, !equipmentAvailable || state.runTouches < cost);
      this.setText(button.element, helperId === "tinySprinkler" && state.helpers.tinySprinkler.count === 0
        ? state.runTouches >= cost
          ? `Buy first Tiny Sprinkler for ${cost} RT`
          : `First Tiny Sprinkler: ${Math.floor(state.runTouches)} / ${cost} RT`
        : `Buy ${HELPERS[helperId].label} for ${cost} RT`);
    }
    for (const button of this.modeButtons) {
      const helperId = button.helperId!;
      const helper = state.helpers[helperId];
      const unlocked = permanent.unlockedModes[helperId].includes(button.modeId!);
      this.setHidden(button.element, !equipmentAvailable || !unlocked);
      this.setDisabled(
        button.element,
        !equipmentAvailable || helper.count <= 0 || helper.modeId === button.modeId || helper.reconfigureRemainingMs > 0,
      );
    }
    for (const button of this.memoryButtons) {
      if (button.touchKind) {
        const kind = button.touchKind;
        const rank = kind === "fastTouch"
          ? permanent.fastTouchRank
          : kind === "broadPalm"
            ? permanent.broadPalmRank
            : permanent.manyHandsRank;
        const unlocked = kind !== "manyHands" || permanent.broadPalmRank >= 2;
        const maxRank = 10;
        const cost = rank >= maxRank ? 0 : getTouchRankCost(kind, rank);
        const label = kind === "fastTouch" ? "Fast Touch" : kind === "broadPalm" ? "Broad Palm" : "Many Hands";
        this.setHidden(button.element, state.active);
        this.setDisabled(button.element, !unlocked || rank >= maxRank || permanent.grassTouches < cost);
        this.setText(button.element, rank >= maxRank
          ? `${label} ${rank}/${maxRank}; complete`
          : `${label} ${rank}/${maxRank}; next ${cost} GT`);
        continue;
      }
      const helperId = button.helperId!;
      if (button.rankKind) {
        const rank = button.rankKind === "throughput"
          ? permanent.throughputRanks[helperId]
          : button.rankKind === "storage"
            ? permanent.storageRanks[helperId]
            : button.rankKind === "efficiency"
              ? permanent.efficiencyRanks[helperId]
              : permanent.startingStockRanks[helperId];
        const maxRank = button.rankKind === "startingStock" ? 5 : 10;
        const cost = getPermanentRankCost(permanent, helperId, button.rankKind);
        this.setHidden(button.element, state.active || !permanent.unlockedHelpers[helperId]);
        this.setDisabled(button.element, rank >= maxRank || permanent.grassTouches < cost);
        this.setText(button.element, `${HELPERS[helperId].label} ${button.rankKind} ${rank}/${maxRank}; next ${cost} GT`);
      } else if (button.modeId) {
        const owned = permanent.unlockedModes[helperId].includes(button.modeId);
        const cost = getModeUnlockCost(helperId);
        this.setHidden(button.element, state.active || !permanent.unlockedHelpers[helperId] || owned);
        this.setDisabled(button.element, permanent.grassTouches < cost);
      } else {
        const prerequisite = HELPERS[helperId].unlockRequires;
        const cost = getHelperUnlockCost(helperId);
        this.setHidden(button.element, state.active || permanent.unlockedHelpers[helperId]);
        this.setDisabled(button.element, Boolean(prerequisite && !permanent.unlockedHelpers[prerequisite]) || permanent.grassTouches < cost);
      }
    }
    if (this.playtestStatus) {
      this.setOutput(this.playtestStatus, `HP ${state.hp.toFixed(1)} | RT ${state.runTouches.toFixed(0)} | GT ${permanent.grassTouches.toFixed(0)} | ${state.field.width}x${state.field.height}`);
    }

    this.setDataset(this.root, "state", state.active ? "active" : "memory");
    this.setDataset(this.root, "worksOpen", `${worksOpen}`);
    this.setDataset(this.root, "optionsOpen", `${optionsOpen}`);
    const prototypeSnapshot = JSON.stringify({
      active: state.active,
      hp: Number(state.hp.toFixed(3)),
      run: state.runNumber,
      elapsedMs: state.elapsedMs,
      field: `${state.field.width}x${state.field.height}`,
      logicalTiles: state.field.stages.length,
      cultivation: state.field.cultivationRank,
      runTouches: Number(state.runTouches.toFixed(3)),
      grassTouches: Number(permanent.grassTouches.toFixed(3)),
      fastTouchRank: permanent.fastTouchRank,
      firstAutomationStage: firstAutomation.stage,
      equipmentAvailable,
      tinySprinklers: equipmentAvailable ? tinySprinkler.count : 0,
      firstSprinklerCost,
      firstSprinklerProgress: !equipmentAvailable
        ? 0
        : tinySprinkler.count > 0
        ? 1
        : Number(Math.min(1, state.runTouches / firstSprinklerCost).toFixed(3)),
      carePerSecond: Number(state.rates.care.toFixed(4)),
      scourgePerSecond: Number(state.scourgeDemandPerSecond.toFixed(4)),
      bottleneck: state.bottleneck,
      worksOpen,
      optionsOpen,
    });
    if (document.documentElement.dataset.grassEcosystemPrototype !== prototypeSnapshot) {
      document.documentElement.dataset.grassEcosystemPrototype = prototypeSnapshot;
    }
  }

  destroy(): void {
    this.root.remove();
    delete document.documentElement.dataset.grassEcosystemDom;
    delete document.documentElement.dataset.grassEcosystemPrototype;
    delete document.documentElement.dataset.grassEcosystemHarness;
  }

  private createCoordinateInput(label: string, testId: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "0";
    input.value = "0";
    input.step = "1";
    input.setAttribute("aria-label", label);
    input.dataset.testid = testId;
    this.positionSemanticControl(input);
    return input;
  }

  private createButton(label: string, onClick: () => void, testId: string, className = ""): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.testid = testId;
    button.className = className || "ecosystem-semantic-control";
    if (!className) this.positionSemanticControl(button);
    button.addEventListener("click", onClick);
    return button;
  }

  private positionSemanticControl(element: HTMLElement): void {
    const index = this.semanticControlIndex;
    this.semanticControlIndex += 1;
    element.classList.add("ecosystem-semantic-control");
    element.style.left = `${(index % 100) * 5}px`;
    element.style.top = `${Math.floor(index / 100) * 5}px`;
  }

  private setText(element: HTMLElement, value: string): void {
    if (element.textContent !== value) element.textContent = value;
  }

  private setOutput(element: HTMLOutputElement, value: string): void {
    if (element.value !== value) element.value = value;
  }

  private setInputMax(element: HTMLInputElement, value: string): void {
    if (element.max !== value) element.max = value;
  }

  private setDisabled(element: HTMLButtonElement, disabled: boolean): void {
    if (element.disabled !== disabled) element.disabled = disabled;
  }

  private setHidden(element: HTMLElement, hidden: boolean): void {
    if (element.hidden !== hidden) element.hidden = hidden;
  }

  private setDataset(element: HTMLElement, key: string, value: string): void {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  }
}
