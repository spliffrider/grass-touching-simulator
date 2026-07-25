import {
  FIELD_SIZE_LADDER,
  GRASS_TOUCHES_LABEL,
  HELPER_IDS,
  HELPERS,
  PRODUCTION_RESOURCE_IDS,
  PRODUCTION_RESOURCES,
  RUN_TOUCHES_LABEL,
  TILE_STAGE_COUNT,
  TileStage,
  type HelperId,
} from "./EcosystemCatalog";
import {
  FIRST_ECOSYSTEM_MEMORY_NODE_ID,
  getHelperModeMemoryId,
  getHelperRankMemoryId,
  getHelperRankMemoryLabel,
  getHelperUnlockMemoryId,
  getRevealedEcosystemMemoryNodeIds,
} from "./EcosystemMemoryTree";
import {
  ANCIENT_HEARTWOOD_MAX_RANK,
  canBeginNextEcosystemRun,
  getBeeHiveStatus,
  getAncientHeartwoodRankCost,
  getFieldExpansionRunTouchCost,
  getDominantChunkStage,
  getFieldMouseStatus,
  getFieldTierUnlockCost,
  getFirstAutomationStatus,
  getHelperAutomationRates,
  getHelperPurchaseCost,
  getHelperStackCycleIntervalMs,
  getHelperUnlockCost,
  getManualTouchPowerBonusPercent,
  getModeUnlockCost,
  getPermanentRankCost,
  getTouchRankCost,
  hasUnlockedFieldExpansion,
  isFirstEcosystemCollapse,
  isFirstMemoryPending,
  isRunEquipmentAvailable,
  type EcosystemState,
  type BeeHiveStatus,
  type FieldMouseStatus,
  type FirstAutomationStatus,
  type PermanentEcosystemState,
  type PermanentRankKind,
  type PermanentTouchRankKind,
} from "./EcosystemSystem";

export interface EcosystemDomActions {
  touchCoordinates(x: number, y: number): void;
  buyHelper(helperId: HelperId): void;
  switchMode(helperId: HelperId, modeId: string): void;
  buyFieldExpansion(): void;
  toggleWorks(): void;
  toggleOptions(): void;
  returnToTitle(): void;
  beginNextRun(): void;
  unlockHelper(helperId: HelperId): void;
  unlockMode(helperId: HelperId, modeId: string): void;
  buyRank(helperId: HelperId, kind: PermanentRankKind): void;
  buyHeartwoodRank(): void;
  unlockFieldTier(): void;
  buyTouchRank(kind: PermanentTouchRankKind): void;
  buyFieldEmbrace(): void;
  addPrototypeCurrency(): void;
  forceGameOver(): void;
  setPrototypeField(size: number): void;
  unlockPrototype(): void;
  stressAutomation(): void;
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
      return `First automation: ${Math.floor(status.purchaseProgress * status.purchaseCost)} / ${status.purchaseCost} ${RUN_TOUCHES_LABEL} toward Tiny Sprinkler`;
    case "ready":
      return `First automation ready: buy Tiny Sprinkler for ${status.purchaseCost} ${RUN_TOUCHES_LABEL}`;
    case "firstCycle":
      return `First sprinkler cycle: an automated touch is charging, cycle ${Math.floor(status.cycleProgress * 100)}%`;
    case "sustain":
      return `Automatic touches online: Tiny Sprinkler needs no fuel, cycle ${Math.floor(status.cycleProgress * 100)}%`;
    case "paused":
      return `Tiny Sprinkler paused: ${status.pauseReason ?? "check its buffers"}`;
  }
}

function getFieldMouseReadableLine(status: FieldMouseStatus): string | null {
  switch (status.stage) {
    case "locked":
      return null;
    case "gather":
      return `Field Mouse invitation: ${Math.floor(status.purchaseProgress * status.purchaseCost)} / ${status.purchaseCost} ${RUN_TOUCHES_LABEL}`;
    case "ready":
      return `Field Mouse ready: invite it for ${status.purchaseCost} ${RUN_TOUCHES_LABEL}; its first cache contains three Seeds`;
    case "firstTrip":
      return status.dampFurrowsLinked
        ? `Field Mouse first trip: carrying a cached Seed through Damp Furrows, cycle ${Math.floor(status.cycleProgress * 100)}%`
        : `Field Mouse first trip: carrying a cached Seed to the field, cycle ${Math.floor(status.cycleProgress * 100)}%`;
    case "working":
      if (status.dampFurrowsFlowing) {
        return `Damp Furrows flowing: ${status.moistureAmount.toFixed(1)} Moisture boosts mouse trips into Growth and Care`;
      }
      if (status.dampFurrowsLinked) {
        return "Damp Furrows linked: waiting for Moisture and open Growth and Care storage";
      }
      return `Field Mouse working: ${status.seedAmount.toFixed(1)} Seeds available, ${status.growthAmount.toFixed(1)} Growth stored`;
    case "starved":
      return "Field Mouse searching: Seed cache empty; keep Dew, Moisture, and Growth moving";
    case "blocked":
      return `Field Mouse waiting: ${status.pauseReason ?? "check its buffers"}`;
  }
}

function getBeeHiveReadableLine(status: BeeHiveStatus): string | null {
  switch (status.stage) {
    case "locked":
      return null;
    case "gather":
      return `Bee Hive foundation: ${Math.floor(status.purchaseProgress * status.purchaseCost)} / ${status.purchaseCost} ${RUN_TOUCHES_LABEL}`;
    case "ready":
      return `Bee Hive ready: establish it for ${status.purchaseCost} ${RUN_TOUCHES_LABEL}; nearby wildflowers provide four Flowers`;
    case "firstFlight":
      return `First pollination flight: a bee is carrying pollen across the field, cycle ${Math.floor(status.cycleProgress * 100)}%`;
    case "working":
      return `Bee Hive working: ${status.flowerAmount.toFixed(1)} Flowers available, ${status.pollinatedBloomAmount.toFixed(1)} Pollinated Blooms stored`;
    case "starved":
      return "Bee Hive searching: Flower stores empty; keep Growth moving into Flowers";
    case "blocked":
      return `Bee Hive waiting: ${status.pauseReason ?? "check its buffers"}`;
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
  private readonly fieldExpansionButton: HTMLButtonElement;
  private readonly worksButton: HTMLButtonElement;
  private readonly optionsButton: HTMLButtonElement;
  private readonly titleButton: HTMLButtonElement;
  private readonly nextRunButton: HTMLButtonElement;
  private readonly heartwoodButton: HTMLButtonElement;
  private readonly fieldTierButton: HTMLButtonElement;
  private readonly fieldEmbraceButton: HTMLButtonElement;
  private readonly playtestStatus?: HTMLOutputElement;
  private semanticControlIndex = 0;

  constructor(
    private readonly actions: EcosystemDomActions,
    playtest: boolean,
    showPlaytestPanel = false,
    private readonly returnToTitleAvailable = false,
  ) {
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
    this.fieldExpansionButton = this.createButton(
      "Expand field",
      () => this.actions.buyFieldExpansion(),
      "ecosystem-expand-field",
    );
    this.worksButton = this.createButton("Open Ecosystem Works", () => this.actions.toggleWorks(), "ecosystem-toggle-works");
    this.optionsButton = this.createButton("Open Options", () => this.actions.toggleOptions(), "ecosystem-toggle-options");
    this.titleButton = this.createButton(
      "Save and return to title screen",
      () => this.actions.returnToTitle(),
      "ecosystem-return-title",
    );
    this.titleButton.hidden = true;
    this.titleButton.disabled = true;
    this.nextRunButton = this.createButton("Begin next run", () => this.actions.beginNextRun(), "ecosystem-next-run");
    controls.append(
      this.fieldExpansionButton,
      this.worksButton,
      this.optionsButton,
      this.titleButton,
      this.nextRunButton,
    );

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
        const memoryLabel = getHelperRankMemoryLabel(helperId, kind);
        const rankButton = this.createButton(
          `Buy ${memoryLabel} rank for ${HELPERS[helperId].label}`,
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
      ["lingeringCare", "Green Afterglow", "ecosystem-rank-lingering-care"],
      ["verdantAegis", "Verdant Aegis", "ecosystem-rank-verdant-aegis"],
    ] as const).map(([touchKind, label, testId]) => {
      const element = this.createButton(`Buy ${label} rank`, () => this.actions.buyTouchRank(touchKind), testId);
      this.memoryButtons.push({ element, touchKind });
      return element;
    });
    this.fieldTierButton = this.createButton(
      "Unlock next field size",
      () => this.actions.unlockFieldTier(),
      "ecosystem-unlock-field",
    );
    this.heartwoodButton = this.createButton(
      "Buy Ancient Heartwood rank",
      () => this.actions.buyHeartwoodRank(),
      "ecosystem-rank-heartwood",
    );
    this.fieldEmbraceButton = this.createButton(
      "Unlock Field Embrace",
      () => this.actions.buyFieldEmbrace(),
      "ecosystem-unlock-field-embrace",
    );
    memories.append(this.heartwoodButton, this.fieldTierButton, ...touchButtons, this.fieldEmbraceButton);
    this.root.append(memories);

    if (playtest) {
      const panel = showPlaytestPanel
        ? document.createElement("details")
        : document.createElement("section");
      panel.className = showPlaytestPanel ? "ecosystem-playtest-panel" : "ecosystem-agent-controls";
      panel.dataset.testid = "ecosystem-playtest-panel";
      panel.setAttribute("aria-label", "Ecosystem playtest controls");
      if (showPlaytestPanel) {
        const summary = document.createElement("summary");
        summary.className = "ecosystem-playtest-summary";
        summary.dataset.testid = "ecosystem-debug-toggle";
        summary.textContent = "Playtest tools";
        panel.append(summary);
      }
      this.playtestStatus = document.createElement("output");
      this.playtestStatus.className = showPlaytestPanel ? "ecosystem-playtest-status" : "ecosystem-agent-readable";
      const buttonClass = showPlaytestPanel ? "ecosystem-playtest-button" : "";
      panel.append(
        this.playtestStatus,
        this.createButton(`+250 ${GRASS_TOUCHES_LABEL} and ${RUN_TOUCHES_LABEL}`, () => this.actions.addPrototypeCurrency(), "ecosystem-debug-currency", buttonClass),
        this.createButton("Unlock all", () => this.actions.unlockPrototype(), "ecosystem-debug-unlock", buttonClass),
        this.createButton("Toggle Works", () => this.actions.toggleWorks(), "ecosystem-debug-works", buttonClass),
        this.createButton("Begin next run", () => this.actions.beginNextRun(), "ecosystem-debug-next-run", buttonClass),
        this.createButton("32x32", () => this.actions.setPrototypeField(32), "ecosystem-debug-field-32", buttonClass),
        this.createButton("50x50", () => this.actions.setPrototypeField(50), "ecosystem-debug-field-50", buttonClass),
        this.createButton("100x100", () => this.actions.setPrototypeField(100), "ecosystem-debug-field-100", buttonClass),
        this.createButton("Stress automation", () => this.actions.stressAutomation(), "ecosystem-debug-automation-stress", buttonClass),
        this.createButton("Force Game Over", () => this.actions.forceGameOver(), "ecosystem-debug-game-over", buttonClass),
        this.createButton("Reset prototype", () => this.actions.resetPrototypeSave(), "ecosystem-debug-reset", buttonClass),
      );
      this.root.append(panel);
    }

    document.body.append(this.root);
    document.documentElement.dataset.grassEcosystemDom = "ready";
  }

  update(
    state: EcosystemState,
    permanent: PermanentEcosystemState,
    worksOpen: boolean,
    optionsOpen: boolean,
    memoryRevealActive = false,
  ): void {
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
    const fieldMouse = getFieldMouseStatus(state, permanent);
    const fieldMouseLine = getFieldMouseReadableLine(fieldMouse);
    const beeHive = getBeeHiveStatus(state, permanent);
    const beeHiveLine = getBeeHiveReadableLine(beeHive);
    const showBeeHiveChapter = beeHive.stage !== "locked"
      && (state.helpers.beeHive.count > 0 || fieldMouse.cyclesCompleted >= 1);
    const firstCollapse = isFirstEcosystemCollapse(state, permanent);
    const firstMemoryPending = isFirstMemoryPending(state, permanent);
    const revealedMemoryNodeIds = memoryRevealActive
      ? new Set([FIRST_ECOSYSTEM_MEMORY_NODE_ID])
      : getRevealedEcosystemMemoryNodeIds(permanent, firstMemoryPending);
    const equipmentAvailable = isRunEquipmentAvailable(state);
    const worksAvailable = equipmentAvailable && permanent.unlockedHelpers.tinySprinkler;
    const fieldExpansionUnlocked = hasUnlockedFieldExpansion(state, permanent);
    const lines = [
      `Ecosystem prototype | Run ${state.runNumber} | ${state.active ? "active" : "Game Over"}`,
      ...(firstMemoryPending
        ? ["First collapse complete: remember Tiny Sprinkler before beginning Run 2"]
        : firstCollapse
          ? ["First memory complete: Run 2 can now build Care automation"]
        : []),
      `Ancient HP ${state.hp.toFixed(1)} / ${state.maxHp.toFixed(0)}`,
      `Scourge demand ${state.scourgeDemandPerSecond.toFixed(2)} Care/s | Care production ${state.rates.care.toFixed(2)}/s`,
      `Field ${state.field.width}x${state.field.height} | ${RUN_TOUCHES_LABEL} ${state.runTouches.toFixed(1)} | ${GRASS_TOUCHES_LABEL} ${permanent.grassTouches.toFixed(0)}`,
      `Automation ${state.automationTouchRate.toFixed(2)} touches/s | ${state.automationHealingRate.toFixed(2)} HP/s | ${state.automatedTouchCount.toFixed(1)} touches completed`,
      `Remembered Touch +${getManualTouchPowerBonusPercent(permanent)}% manual power`,
      ...(permanent.lingeringCareRank > 0
        ? [`Lingering Care ${state.lingeringCarePerSecond.toFixed(2)} Care/s | ${(state.lingeringCareRemainingMs / 1_000).toFixed(1)}s remaining`]
        : []),
      ...(permanent.storageRanks.tinySprinkler > 0
        ? [`Sprinkler afterglow ${state.sprinklerAfterglowPerSecond.toFixed(2)} HP/s | ${(state.sprinklerAfterglowRemainingMs / 1_000).toFixed(1)}s remaining`]
        : []),
      ...(permanent.verdantAegisRank > 0
        ? [`Verdant Aegis ${state.overhealShield.toFixed(1)} / ${state.maxOverhealShield.toFixed(1)} shield | ${(state.overhealShieldRemainingMs / 1_000).toFixed(1)}s remaining`]
        : []),
      state.runNumber === 1
        ? state.manualTouchCount === 0
          ? "First lesson: touch the living field to wake the Ancient Grass"
          : `First lesson: touch when the recovery line clears; collapse banks ${GRASS_TOUCHES_LABEL}`
        : "Hand Tending: each recovered manual touch produces Growth",
      ...(automationLine ? [automationLine] : []),
      ...(fieldMouseLine ? [fieldMouseLine] : []),
      ...(showBeeHiveChapter && beeHiveLine ? [beeHiveLine] : []),
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
            const automation = getHelperAutomationRates(state, permanent, helperId);
            return `${HELPERS[helperId].label}: ${helper.count}, ${helper.modeId}, ${automation.touchesPerSecond.toFixed(2)} touches/s${helper.lastPauseReason ? `, ${helper.lastPauseReason}` : ""}`;
          }),
        ]
        : [state.runNumber === 1
          ? "Equipment: unavailable during Run 1"
          : "Equipment: paused while the field is still"]),
    ];
    this.setOutput(this.readable, lines.join("\n"));
    this.setInputMax(this.xInput, `${Math.max(0, state.field.width - 1)}`);
    this.setInputMax(this.yInput, `${Math.max(0, state.field.height - 1)}`);
    const nextFieldSize = FIELD_SIZE_LADDER[state.field.sizeIndex + 1];
    const expansionCost = getFieldExpansionRunTouchCost(state.field.sizeIndex + 1);
    this.setDisabled(
      this.fieldExpansionButton,
      !state.active
        || !fieldExpansionUnlocked
        || nextFieldSize === undefined
        || state.runTouches < expansionCost,
    );
    this.setHidden(this.fieldExpansionButton, !state.active || !fieldExpansionUnlocked);
    this.setText(
      this.fieldExpansionButton,
      nextFieldSize === undefined
        ? "Field fully expanded"
        : `Expand field to ${nextFieldSize} by ${nextFieldSize} for ${expansionCost} ${RUN_TOUCHES_LABEL}`,
    );
    this.setText(this.worksButton, worksOpen ? "Close Ecosystem Works" : "Open Ecosystem Works");
    this.setHidden(this.worksButton, !worksAvailable);
    this.setDisabled(this.worksButton, !worksAvailable);
    this.setText(this.optionsButton, optionsOpen ? "Close Options" : "Open Options");
    this.setHidden(this.titleButton, !this.returnToTitleAvailable || !optionsOpen);
    this.setDisabled(this.titleButton, !this.returnToTitleAvailable || !optionsOpen);
    this.setText(this.nextRunButton, firstMemoryPending
      ? "Remember Tiny Sprinkler first"
      : firstCollapse
        ? "Begin Run 2"
        : "Begin next run");
    this.setDisabled(
      this.nextRunButton,
      memoryRevealActive || !canBeginNextEcosystemRun(state, permanent),
    );

    for (const button of this.buyButtons) {
      const helperId = button.helperId!;
      const unlocked = permanent.unlockedHelpers[helperId];
      const cost = getHelperPurchaseCost(state, helperId);
      const automation = getHelperAutomationRates(state, permanent, helperId);
      this.setHidden(button.element, !equipmentAvailable || !unlocked);
      this.setDisabled(button.element, !equipmentAvailable || state.runTouches < cost);
      this.setText(button.element, helperId === "tinySprinkler" && state.helpers.tinySprinkler.count === 0
        ? state.runTouches >= cost
          ? `Buy first Tiny Sprinkler for ${cost} ${RUN_TOUCHES_LABEL}`
          : `First Tiny Sprinkler: ${Math.floor(state.runTouches)} / ${cost} ${RUN_TOUCHES_LABEL}`
        : helperId === "fieldMouse" && state.helpers.fieldMouse.count === 0
          ? state.runTouches >= cost
            ? `Invite first Field Mouse for ${cost} ${RUN_TOUCHES_LABEL}`
            : `First Field Mouse: ${Math.floor(state.runTouches)} / ${cost} ${RUN_TOUCHES_LABEL}`
        : helperId === "beeHive" && state.helpers.beeHive.count === 0
          ? state.runTouches >= cost
            ? `Establish first Bee Hive for ${cost} ${RUN_TOUCHES_LABEL}`
            : `First Bee Hive: ${Math.floor(state.runTouches)} / ${cost} ${RUN_TOUCHES_LABEL}`
        : `Buy ${HELPERS[helperId].label} for ${cost} ${RUN_TOUCHES_LABEL}; current automation ${automation.touchesPerSecond.toFixed(2)} touches per second`);
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
        const nodeId = `touch:${kind}`;
        const rank = kind === "fastTouch"
          ? permanent.fastTouchRank
          : kind === "broadPalm"
            ? permanent.broadPalmRank
            : kind === "manyHands"
              ? permanent.manyHandsRank
              : kind === "lingeringCare"
                ? permanent.lingeringCareRank
                : permanent.verdantAegisRank;
        const unlocked = kind === "manyHands"
          ? permanent.broadPalmRank >= 2
          : kind === "lingeringCare"
            ? permanent.heartwoodRank >= 1
            : kind === "verdantAegis"
              ? permanent.lingeringCareRank >= 1
              : true;
        const maxRank = 10;
        const cost = rank >= maxRank ? 0 : getTouchRankCost(kind, rank);
        const label = kind === "fastTouch"
          ? "Fast Touch"
          : kind === "broadPalm"
            ? "Broad Palm"
            : kind === "manyHands"
              ? "Many Hands"
              : kind === "lingeringCare"
                ? "Green Afterglow"
                : "Verdant Aegis";
        this.setHidden(button.element, state.active || !revealedMemoryNodeIds.has(nodeId));
        this.setDisabled(button.element, !unlocked || rank >= maxRank || permanent.grassTouches < cost);
        this.setText(button.element, rank >= maxRank
          ? `${label} ${rank}/${maxRank}; complete`
          : `${label} ${rank}/${maxRank}; next ${cost} ${GRASS_TOUCHES_LABEL}`);
        continue;
      }
      const helperId = button.helperId!;
      if (button.rankKind) {
        const nodeId = getHelperRankMemoryId(helperId, button.rankKind);
        const rank = button.rankKind === "throughput"
          ? permanent.throughputRanks[helperId]
          : button.rankKind === "storage"
            ? permanent.storageRanks[helperId]
            : button.rankKind === "efficiency"
              ? permanent.efficiencyRanks[helperId]
              : permanent.startingStockRanks[helperId];
        const maxRank = button.rankKind === "startingStock" ? 5 : 10;
        const cost = getPermanentRankCost(permanent, helperId, button.rankKind);
        this.setHidden(
          button.element,
          state.active
          || !revealedMemoryNodeIds.has(nodeId)
          || !permanent.unlockedHelpers[helperId],
        );
        this.setDisabled(button.element, rank >= maxRank || permanent.grassTouches < cost);
        const memoryLabel = getHelperRankMemoryLabel(helperId, button.rankKind);
        this.setText(button.element, `${memoryLabel} (${HELPERS[helperId].label}) ${rank}/${maxRank}; next ${cost} ${GRASS_TOUCHES_LABEL}`);
      } else if (button.modeId) {
        const nodeId = getHelperModeMemoryId(helperId);
        const owned = permanent.unlockedModes[helperId].includes(button.modeId);
        const cost = getModeUnlockCost(helperId);
        this.setHidden(
          button.element,
          state.active
          || !revealedMemoryNodeIds.has(nodeId)
          || !permanent.unlockedHelpers[helperId]
          || owned,
        );
        this.setDisabled(button.element, permanent.grassTouches < cost);
      } else {
        const nodeId = getHelperUnlockMemoryId(helperId);
        const prerequisite = HELPERS[helperId].unlockRequires;
        const cost = getHelperUnlockCost(helperId);
        this.setHidden(
          button.element,
          state.active
          || !revealedMemoryNodeIds.has(nodeId)
          || permanent.unlockedHelpers[helperId],
        );
        this.setDisabled(button.element, Boolean(prerequisite && !permanent.unlockedHelpers[prerequisite]) || permanent.grassTouches < cost);
      }
    }
    const heartwoodRank = permanent.heartwoodRank;
    const heartwoodComplete = heartwoodRank >= ANCIENT_HEARTWOOD_MAX_RANK;
    const heartwoodCost = heartwoodComplete ? 0 : getAncientHeartwoodRankCost(heartwoodRank);
    this.setHidden(this.heartwoodButton, state.active || !revealedMemoryNodeIds.has("field:heartwood"));
    this.setDisabled(this.heartwoodButton, heartwoodComplete || permanent.grassTouches < heartwoodCost);
    this.setText(
      this.heartwoodButton,
      heartwoodComplete
        ? `Ancient Heartwood ${heartwoodRank}/${ANCIENT_HEARTWOOD_MAX_RANK}; complete`
        : `Ancient Heartwood ${heartwoodRank}/${ANCIENT_HEARTWOOD_MAX_RANK}; next ${heartwoodCost} ${GRASS_TOUCHES_LABEL}`,
    );
    const fieldTierComplete = permanent.maxFieldTier >= FIELD_SIZE_LADDER.length - 1;
    const nextFieldTier = Math.min(FIELD_SIZE_LADDER.length - 1, permanent.maxFieldTier + 1);
    const nextFieldCost = fieldTierComplete ? 0 : getFieldTierUnlockCost(nextFieldTier);
    const nextRememberedFieldSize = FIELD_SIZE_LADDER[nextFieldTier];
    this.setHidden(this.fieldTierButton, state.active || !revealedMemoryNodeIds.has("field:tier"));
    this.setDisabled(this.fieldTierButton, fieldTierComplete || permanent.grassTouches < nextFieldCost);
    this.setText(
      this.fieldTierButton,
      fieldTierComplete
        ? "Expanding Field complete; 100 by 100 remembered"
        : `Remember ${nextRememberedFieldSize} by ${nextRememberedFieldSize} field for ${nextFieldCost} ${GRASS_TOUCHES_LABEL}`,
    );
    this.setHidden(
      this.fieldEmbraceButton,
      state.active || !revealedMemoryNodeIds.has("touch:fieldEmbrace"),
    );
    if (this.playtestStatus) {
      this.setOutput(this.playtestStatus, `HP ${state.hp.toFixed(1)} | ${RUN_TOUCHES_LABEL} ${state.runTouches.toFixed(0)} | ${GRASS_TOUCHES_LABEL} ${permanent.grassTouches.toFixed(0)} | ${state.field.width}x${state.field.height}`);
    }

    this.setDataset(this.root, "state", state.active ? "active" : "memory");
    this.setDataset(this.root, "worksOpen", `${worksOpen}`);
    this.setDataset(this.root, "optionsOpen", `${optionsOpen}`);
    const tinySprinklerCycleMs = getHelperStackCycleIntervalMs(
      state,
      permanent,
      "tinySprinkler",
    );
    const prototypeSnapshot = JSON.stringify({
      active: state.active,
      hp: Number(state.hp.toFixed(3)),
      run: state.runNumber,
      elapsedMs: state.elapsedMs,
      field: `${state.field.width}x${state.field.height}`,
      logicalTiles: state.field.stages.length,
      fieldExpansionUnlocked,
      fieldExpansionCost: expansionCost,
      growth: Number(state.resources.growth.amount.toFixed(3)),
      runTouches: Number(state.runTouches.toFixed(3)),
      automatedTouches: Number(state.automatedTouchCount.toFixed(3)),
      automationTouchesPerSecond: Number(state.automationTouchRate.toFixed(4)),
      automationHealing: Number(state.automatedHealingTotal.toFixed(3)),
      automationHealingPerSecond: Number(state.automationHealingRate.toFixed(4)),
      sprinklerAfterglowPerSecond: Number(state.sprinklerAfterglowPerSecond.toFixed(4)),
      fineMistProcCount: state.sprinklerFineMistProcCount,
      grassTouches: Number(permanent.grassTouches.toFixed(3)),
      manualTouchBonusPercent: getManualTouchPowerBonusPercent(permanent),
      heartwoodRank: permanent.heartwoodRank,
      lingeringCareRank: permanent.lingeringCareRank,
      lingeringCarePerSecond: Number(state.lingeringCarePerSecond.toFixed(4)),
      lingeringCareRemainingMs: state.lingeringCareRemainingMs,
      verdantAegisRank: permanent.verdantAegisRank,
      overhealShield: Number(state.overhealShield.toFixed(4)),
      maxOverhealShield: Number(state.maxOverhealShield.toFixed(4)),
      overhealShieldRemainingMs: state.overhealShieldRemainingMs,
      maxHp: state.maxHp,
      fastTouchRank: permanent.fastTouchRank,
      firstAutomationStage: firstAutomation.stage,
      fieldMouseStage: fieldMouse.stage,
      fieldMice: equipmentAvailable ? state.helpers.fieldMouse.count : 0,
      fieldMouseCycles: Number(fieldMouse.cyclesCompleted.toFixed(3)),
      fieldMouseCycleProgress: Number(fieldMouse.cycleProgress.toFixed(3)),
      dampFurrowsLinked: fieldMouse.dampFurrowsLinked,
      dampFurrowsFlowing: fieldMouse.dampFurrowsFlowing,
      seedCache: Number(fieldMouse.seedAmount.toFixed(3)),
      beeHiveStage: beeHive.stage,
      beeHives: equipmentAvailable ? state.helpers.beeHive.count : 0,
      beeHiveCycles: Number(beeHive.cyclesCompleted.toFixed(3)),
      beeHiveCycleProgress: Number(beeHive.cycleProgress.toFixed(3)),
      flowerReserve: Number(beeHive.flowerAmount.toFixed(3)),
      pollinatedBlooms: Number(beeHive.pollinatedBloomAmount.toFixed(3)),
      firstMemoryFocus: firstMemoryPending || memoryRevealActive,
      memoryRevealActive,
      revealedMemoryNodes: state.active ? 0 : revealedMemoryNodeIds.size,
      equipmentAvailable,
      tinySprinklers: equipmentAvailable ? tinySprinkler.count : 0,
      tinySprinklerCycles: Number(tinySprinkler.cyclesCompleted.toFixed(3)),
      tinySprinklerCycleProgress: Number(tinySprinkler.pulseProgress.toFixed(3)),
      tinySprinklerCycleMs: Number.isFinite(tinySprinklerCycleMs)
        ? Number(tinySprinklerCycleMs.toFixed(3))
        : null,
      tinySprinklerPauseReason: tinySprinkler.lastPauseReason,
      dew: Number(state.resources.dew.amount.toFixed(3)),
      moisture: Number(state.resources.moisture.amount.toFixed(3)),
      care: Number(state.resources.care.amount.toFixed(3)),
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
