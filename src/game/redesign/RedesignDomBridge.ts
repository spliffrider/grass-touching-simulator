import {
  PERMANENT_UPGRADE_DEFINITIONS,
  type PermanentUpgradeId,
  type PermanentUpgradeRanks,
} from "./RunSpineSystem";
import { RUN_TOOL_IDS, RUN_TOOL_VIEW, type RunToolId } from "./RunToolCatalog";
import { FIELD_EQUIPMENT, FIELD_EQUIPMENT_IDS, type FieldEquipmentId } from "./FieldEquipmentCatalog";

export interface RedesignDomRootNode {
  rootId: number;
  x: number;
  y: number;
  visualSize: number;
  wounded: boolean;
  recovering: boolean;
  recoveryRatio: number;
  scourgeSenseTarget: boolean;
  scourgeSenseMarkerVisible: boolean;
}

export interface RedesignDomMemoryButton {
  upgradeId: PermanentUpgradeId;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  unlocked: boolean;
  affordable: boolean;
  owned: boolean;
  rank: number;
  maxRank: number;
  cost: number;
}

export interface RedesignDomLockedMetaNode {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface RedesignDomNextRunButton {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface RedesignDomRunToolButton {
  toolId: RunToolId;
  x: number;
  y: number;
  width: number;
  height: number;
  cost: number;
  count: number;
  hotkey: number | null;
  visible: boolean;
  usable: boolean;
  affordable: boolean;
}

export interface RedesignDomFieldEquipmentButton {
  equipmentId: FieldEquipmentId;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  unlocked: boolean;
  affordable: boolean;
  owned: number;
  cost: number;
  lockReason: string;
}

export interface RedesignDomButtonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  enabled: boolean;
}

export interface RedesignDomMemoryTreeView {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  panX: number;
  panY: number;
  dragging: boolean;
  viewportX: number;
  viewportY: number;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  fitScale: number;
  zoomOutButton: RedesignDomButtonBounds;
  resetButton: RedesignDomButtonBounds;
  zoomInButton: RedesignDomButtonBounds;
}

export interface RedesignDomRunToolBarView {
  x: number;
  y: number;
  width: number;
  height: number;
  slotCapacity: number;
  equippedCount: number;
  page: number;
  pageCount: number;
  pageCapacity: number;
  columns: number;
  rows: number;
  previousButton: RedesignDomButtonBounds;
  nextButton: RedesignDomButtonBounds;
}

export interface RedesignDomSliderBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  value: number;
}

export interface RedesignDomOptionsState {
  visible: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  openButton: RedesignDomButtonBounds;
  closeButton: RedesignDomButtonBounds;
  musicOnButton: RedesignDomButtonBounds;
  musicOffButton: RedesignDomButtonBounds;
  musicVolumeSlider: RedesignDomSliderBounds;
  sfxVolumeSlider: RedesignDomSliderBounds;
  sfxTestButton: RedesignDomButtonBounds;
}

export interface RedesignDomPlaytestState {
  enabled: boolean;
  modeLabel: string;
  grantAmount: number;
  canForceDormancy: boolean;
  canRestartRun: boolean;
  canResetMemory: boolean;
}

export interface RedesignDomSnapshot {
  phase: "active" | "dormant";
  runEnded: boolean;
  ancientHp: number;
  ancientMaxHp: number;
  runTouches: number;
  totalRunTouchesEarned: number;
  permanentGrassTouches: number;
  permanentUpgrades: PermanentUpgradeId[];
  permanentUpgradeRanks: PermanentUpgradeRanks;
  scourgePressure: number;
  tinySprinklers: number;
  scourgeSenseOwned: boolean;
  scourgeSenseTargetRootId: number | null;
  scourgeSenseWarningVisible: boolean;
  lastStandOwned: boolean;
  lastStandAvailable: boolean;
  lastStandUsed: boolean;
  lastStandTriggeredAt: number;
  woundPressureRatio: number;
  activeObjectiveId: string | null;
  roots: RedesignDomRootNode[];
  introActive: boolean;
  playerPanelTitle: string;
  playerPanelBody: string;
  advisorPanelBody: string;
  objectiveText: string;
  promptText: string;
  metaScreenVisible: boolean;
  summaryVisible: boolean;
  dormancyRewardLine: string;
  dormancyReportLines: string[];
  dormancyActionHint: string;
  memoryUpgradeButtons: RedesignDomMemoryButton[];
  lockedMetaNodes: RedesignDomLockedMetaNode[];
  memoryTreeView: RedesignDomMemoryTreeView;
  nextRunButton: RedesignDomNextRunButton;
  runToolButtons: RedesignDomRunToolButton[];
  runToolBarView: RedesignDomRunToolBarView;
  fieldEquipmentButtons: RedesignDomFieldEquipmentButton[];
  options: RedesignDomOptionsState;
  playtest: RedesignDomPlaytestState;
}

interface RedesignDomActions {
  touchRoot(rootId: number): void;
  activateRunTool(toolId: RunToolId): void;
  previewRunTool(toolId: RunToolId): void;
  clearRunToolPreview(toolId: RunToolId): void;
  previousRunToolPage(): void;
  nextRunToolPage(): void;
  buyFieldEquipment(equipmentId: FieldEquipmentId): void;
  previewMemory(upgradeId: PermanentUpgradeId): void;
  clearMemoryPreview(upgradeId: PermanentUpgradeId): void;
  purchaseMemory(upgradeId: PermanentUpgradeId): void;
  beginNextRun(): void;
  zoomMemoryTreeIn(): void;
  zoomMemoryTreeOut(): void;
  resetMemoryTreeView(): void;
  openOptions(): void;
  closeOptions(): void;
  turnMusicOn(): void;
  turnMusicOff(): void;
  setMusicVolume(volume: number): void;
  setSfxVolume(volume: number): void;
  testSfx(): void;
  forceDormancy(): void;
  grantMemory(): void;
  restartRun(): void;
  resetMemory(): void;
}

export class RedesignDomBridge {
  private readonly layer: HTMLElement;
  private readonly readable: HTMLElement;
  private readonly dormancyReport: HTMLElement;
  private readonly rootButtons = new Map<number, HTMLButtonElement>();
  private readonly memoryButtons = new Map<PermanentUpgradeId, HTMLButtonElement>();
  private readonly lockedNodeButtons = new Map<string, HTMLButtonElement>();
  private readonly runToolButtons: Record<RedesignDomRunToolButton["toolId"], HTMLButtonElement>;
  private readonly runToolPreviousPageButton: HTMLButtonElement;
  private readonly runToolNextPageButton: HTMLButtonElement;
  private readonly fieldEquipmentButtons: Record<FieldEquipmentId, HTMLButtonElement>;
  private readonly nextRunButton: HTMLButtonElement;
  private readonly memoryTreeZoomOutButton: HTMLButtonElement;
  private readonly memoryTreeZoomResetButton: HTMLButtonElement;
  private readonly memoryTreeZoomInButton: HTMLButtonElement;
  private readonly optionsButton: HTMLButtonElement;
  private readonly optionsCloseButton: HTMLButtonElement;
  private readonly musicToggleButton: HTMLButtonElement;
  private readonly sfxTestButton: HTMLButtonElement;
  private readonly musicVolumeRange: HTMLInputElement;
  private readonly sfxVolumeRange: HTMLInputElement;
  private readonly playtestPanel: HTMLElement;
  private readonly playtestStatus: HTMLElement;
  private readonly forceDormancyButton: HTMLButtonElement;
  private readonly grantMemoryButton: HTMLButtonElement;
  private readonly restartRunButton: HTMLButtonElement;
  private readonly resetMemoryButton: HTMLButtonElement;
  private musicToggleAction: "turn-on" | "turn-off" = "turn-off";

  constructor(private readonly actions: RedesignDomActions) {
    document.getElementById("grass-agent-layer")?.remove();
    this.layer = document.createElement("section");
    this.layer.id = "grass-agent-layer";
    this.layer.className = "grass-agent-layer";
    this.layer.setAttribute("aria-label", "Grass Touching Simulator agent controls");
    this.layer.dataset.testid = "redesign-dom-agent-layer";

    this.readable = document.createElement("output");
    this.readable.className = "grass-agent-readable";
    this.readable.dataset.testid = "redesign-readable-state";
    this.readable.setAttribute("aria-live", "polite");
    this.layer.append(this.readable);

    this.dormancyReport = document.createElement("output");
    this.dormancyReport.className = "grass-agent-dormancy-report";
    this.dormancyReport.dataset.testid = "redesign-dormancy-report";
    this.dormancyReport.setAttribute("aria-live", "polite");
    this.layer.append(this.dormancyReport);

    this.runToolButtons = Object.fromEntries(
      RUN_TOOL_IDS.map((toolId) => {
        const view = RUN_TOOL_VIEW[toolId];
        return [toolId, this.createButton(view.domTestId, view.name, () => this.actions.activateRunTool(toolId))];
      }),
    ) as Record<RunToolId, HTMLButtonElement>;
    for (const toolId of RUN_TOOL_IDS) {
      const button = this.runToolButtons[toolId];
      button.classList.add("grass-agent-run-tool-button");
      const preview = () => this.actions.previewRunTool(toolId);
      const clearPreview = () => this.actions.clearRunToolPreview(toolId);
      button.addEventListener("pointerenter", preview);
      button.addEventListener("mouseover", preview);
      button.addEventListener("focus", preview);
      button.addEventListener("pointerleave", clearPreview);
      button.addEventListener("mouseout", clearPreview);
      button.addEventListener("blur", clearPreview);
    }
    this.runToolPreviousPageButton = this.createButton("redesign-run-tool-previous-page", "Previous tool page", () => this.actions.previousRunToolPage());
    this.runToolPreviousPageButton.classList.add("grass-agent-run-tool-page-button");
    this.runToolNextPageButton = this.createButton("redesign-run-tool-next-page", "Next tool page", () => this.actions.nextRunToolPage());
    this.runToolNextPageButton.classList.add("grass-agent-run-tool-page-button");
    this.fieldEquipmentButtons = Object.fromEntries(
      FIELD_EQUIPMENT_IDS.map((equipmentId) => [
        equipmentId,
        this.createButton(
          `redesign-field-equipment-${equipmentId}`,
          `Buy ${FIELD_EQUIPMENT[equipmentId].name}`,
          () => this.actions.buyFieldEquipment(equipmentId),
        ),
      ]),
    ) as Record<FieldEquipmentId, HTMLButtonElement>;
    this.nextRunButton = this.createButton("redesign-begin-next-run-button", "Begin Next Run", () => this.actions.beginNextRun());
    this.nextRunButton.classList.add("grass-agent-meta-action");
    this.memoryTreeZoomOutButton = this.createButton("redesign-memory-tree-zoom-out", "Zoom out", () => this.actions.zoomMemoryTreeOut());
    this.memoryTreeZoomOutButton.classList.add("grass-agent-memory-view-control");
    this.memoryTreeZoomResetButton = this.createButton("redesign-memory-tree-reset-view", "Reset tree view", () => this.actions.resetMemoryTreeView());
    this.memoryTreeZoomResetButton.classList.add("grass-agent-memory-view-control");
    this.memoryTreeZoomInButton = this.createButton("redesign-memory-tree-zoom-in", "Zoom in", () => this.actions.zoomMemoryTreeIn());
    this.memoryTreeZoomInButton.classList.add("grass-agent-memory-view-control");
    this.optionsButton = this.createButton("redesign-options-button", "Options", () => this.actions.openOptions());
    this.optionsButton.classList.add("grass-agent-options-button");
    this.optionsCloseButton = this.createButton("redesign-options-close-button", "Close Options", () => this.actions.closeOptions());
    this.optionsCloseButton.classList.add("grass-agent-options-control");
    this.musicToggleButton = this.createButton("redesign-music-off-button", "Turn Music Off", () => {
      if (this.musicToggleAction === "turn-on") {
        this.actions.turnMusicOn();
        return;
      }

      this.actions.turnMusicOff();
    });
    this.musicToggleButton.classList.add("grass-agent-options-control");
    this.sfxTestButton = this.createButton("redesign-sfx-test-button", "Test SFX", () => this.actions.testSfx());
    this.sfxTestButton.classList.add("grass-agent-options-control");
    this.musicVolumeRange = this.createRange("redesign-music-volume-range", "Music volume", (volume) => this.actions.setMusicVolume(volume));
    this.sfxVolumeRange = this.createRange("redesign-sfx-volume-range", "SFX volume", (volume) => this.actions.setSfxVolume(volume));
    this.playtestPanel = document.createElement("aside");
    this.playtestPanel.className = "grass-agent-playtest-panel";
    this.playtestPanel.dataset.testid = "redesign-playtest-panel";
    this.playtestPanel.setAttribute("aria-label", "Redesign playtest controls");
    this.playtestStatus = document.createElement("div");
    this.playtestStatus.className = "grass-agent-playtest-status";
    this.playtestPanel.append(this.playtestStatus);
    this.forceDormancyButton = this.createPlaytestButton("redesign-playtest-force-dormancy", "Force Game Over", () => this.actions.forceDormancy());
    this.grantMemoryButton = this.createPlaytestButton("redesign-playtest-grant-gt", "+20 GT", () => this.actions.grantMemory());
    this.restartRunButton = this.createPlaytestButton("redesign-playtest-restart-run", "Restart Run", () => this.actions.restartRun());
    this.resetMemoryButton = this.createPlaytestButton("redesign-playtest-reset-save", "Reset Save", () => this.actions.resetMemory());
    this.layer.append(this.playtestPanel);

    document.body.append(this.layer);
    document.documentElement.dataset.grassAgentDom = "ready";
  }

  destroy(): void {
    this.layer.remove();
    delete document.documentElement.dataset.grassAgentDom;
  }

  render(snapshot: RedesignDomSnapshot): void {
    this.layer.dataset.phase = snapshot.phase;
    this.layer.dataset.runEnded = String(snapshot.runEnded);
    this.layer.dataset.objective = snapshot.activeObjectiveId ?? "";
    this.layer.dataset.metaScreenVisible = String(snapshot.metaScreenVisible);
    this.layer.dataset.summaryVisible = String(snapshot.summaryVisible);
    this.renderReadableState(snapshot);
    this.renderDormancyReport(snapshot);
    this.renderRootButtons(snapshot);
    this.renderRunToolButtons(snapshot);
    this.renderRunToolBarView(snapshot);
    this.renderFieldEquipment(snapshot);
    this.renderMemoryButtons(snapshot);
    this.renderLockedNodes(snapshot);
    this.renderMemoryTreeView(snapshot);
    this.renderNextRunButton(snapshot);
    this.renderOptions(snapshot);
    this.renderPlaytest(snapshot);
  }

  private createButton(testId: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "grass-agent-button";
    button.dataset.testid = testId;
    button.textContent = label;
    button.setAttribute("aria-label", label);
    const activate = (now = Date.now()) => {
      button.dataset.lastPointerActivationAt = String(now);
      onClick();
    };
    const activateFromPointer = () => {
      const now = Date.now();
      const lastPointerActivationAt = Number(button.dataset.lastPointerActivationAt ?? 0);
      if (now - lastPointerActivationAt < 80) {
        return;
      }
      activate(now);
    };
    const handlePointerActivation = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      activateFromPointer();
    };
    button.addEventListener("pointerdown", handlePointerActivation);
    button.addEventListener("mousedown", handlePointerActivation);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const lastPointerActivationAt = Number(button.dataset.lastPointerActivationAt ?? 0);
      if (Date.now() - lastPointerActivationAt < 350) {
        return;
      }
      activate();
    });
    this.layer.append(button);
    return button;
  }

  private createPlaytestButton(testId: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "grass-agent-playtest-button";
    button.dataset.testid = testId;
    button.textContent = label;
    button.setAttribute("aria-label", label);
    let lastPointerActivationAt = 0;
    const activate = () => {
      onClick();
    };
    const handlePointerActivation = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastPointerActivationAt < 80) {
        return;
      }
      lastPointerActivationAt = now;
      activate();
    };
    button.addEventListener("pointerdown", handlePointerActivation);
    button.addEventListener("mousedown", handlePointerActivation);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - lastPointerActivationAt < 350) {
        return;
      }
      activate();
    });
    this.playtestPanel.append(button);
    return button;
  }

  private createRange(testId: string, label: string, onInput: (value: number) => void): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.className = "grass-agent-range";
    input.dataset.testid = testId;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => {
      onInput(Number(input.value) / 100);
    });
    this.layer.append(input);
    return input;
  }

  private renderReadableState(snapshot: RedesignDomSnapshot): void {
    this.readable.textContent = [
      "Grass Touching Simulator redesign DOM interface",
      `Phase: ${snapshot.phase}`,
      `Objective: ${snapshot.objectiveText}`,
      `Prompt: ${snapshot.promptText}`,
      `Ancient HP: ${snapshot.ancientHp.toFixed(1)} / ${snapshot.ancientMaxHp}`,
      `Run Touches: ${snapshot.runTouches}`,
      `Total Run Touches earned: ${snapshot.totalRunTouchesEarned}`,
      `Permanent GT: ${snapshot.permanentGrassTouches}`,
      `Scourge pressure: ${snapshot.scourgePressure.toFixed(2)}`,
      `Field equipment: ${snapshot.fieldEquipmentButtons.map((equipment) => `${FIELD_EQUIPMENT[equipment.equipmentId].shortName} x${equipment.owned}${equipment.unlocked ? "" : " locked"}`).join(", ")}`,
      `Scourge Sense: ${snapshot.scourgeSenseOwned ? "owned" : "locked"}`,
      `Last Stand: ${snapshot.lastStandOwned ? snapshot.lastStandAvailable ? "armed" : snapshot.lastStandUsed ? "spent" : "owned" : "locked"}`,
      `Last Stand triggered at: ${snapshot.lastStandTriggeredAt}`,
      `Wound pressure: ${Math.round(snapshot.woundPressureRatio * 100)}%`,
      `Scourge Sense target: ${snapshot.scourgeSenseTargetRootId === null ? "none" : `root ${snapshot.scourgeSenseTargetRootId + 1}`}`,
      `Scourge Sense warning visible: ${snapshot.scourgeSenseWarningVisible}`,
      `Player: ${snapshot.playerPanelTitle} - ${snapshot.playerPanelBody.replace(/\n/g, " ")}`,
      `Meta screen visible: ${snapshot.metaScreenVisible}`,
      `Run ended: ${snapshot.runEnded}`,
      `Dormancy reward: ${snapshot.dormancyRewardLine}`,
      `Dormancy report: ${snapshot.dormancyReportLines.join(" | ")}`,
      `Dormancy action: ${snapshot.dormancyActionHint}`,
      `Memory tree zoom: ${Math.round(snapshot.memoryTreeView.zoom * 100)}%`,
      `Options visible: ${snapshot.options.visible}`,
      `Music: ${snapshot.options.musicEnabled ? "on" : "off"} at ${Math.round(snapshot.options.musicVolume * 100)}%`,
      `SFX: ${Math.round(snapshot.options.sfxVolume * 100)}%`,
      `Playtest: ${snapshot.playtest.enabled ? snapshot.playtest.modeLabel : "off"}`,
    ].join("\n");
  }

  private renderDormancyReport(snapshot: RedesignDomSnapshot): void {
    this.dormancyReport.hidden = !snapshot.summaryVisible;
    this.dormancyReport.textContent = [
      "Game Over: Dormancy",
      snapshot.dormancyRewardLine,
      ...snapshot.dormancyReportLines,
      snapshot.dormancyActionHint,
    ].filter(Boolean).join("\n");
  }

  private renderRootButtons(snapshot: RedesignDomSnapshot): void {
    const activeRootIds = new Set(snapshot.roots.map((root) => root.rootId));
    for (const [rootId, button] of this.rootButtons) {
      if (!activeRootIds.has(rootId)) {
        button.remove();
        this.rootButtons.delete(rootId);
      }
    }

    for (const root of snapshot.roots) {
      const button = this.getRootButton(root.rootId);
      const label = `${root.wounded ? "Heal wounded" : "Touch"} root ${root.rootId + 1}`;
      button.textContent = label;
      button.setAttribute("aria-label", label);
      button.dataset.wounded = String(root.wounded);
      button.dataset.recovering = String(root.recovering);
      button.dataset.recoveryRatio = String(root.recoveryRatio);
      button.dataset.scourgeSenseTarget = String(root.scourgeSenseTarget);
      button.dataset.scourgeSenseMarkerVisible = String(root.scourgeSenseMarkerVisible);
      button.disabled = snapshot.phase !== "active" || (!root.wounded && root.recovering);
      this.positionButton(button, root.x, root.y, root.visualSize, root.visualSize, snapshot.phase === "active");
    }
  }

  private getRootButton(rootId: number): HTMLButtonElement {
    const existing = this.rootButtons.get(rootId);
    if (existing) {
      return existing;
    }

    const button = this.createButton(`redesign-root-${rootId}`, `Touch root ${rootId + 1}`, () => this.actions.touchRoot(rootId));
    button.classList.add("grass-agent-root-button");
    button.dataset.rootId = String(rootId);
    this.rootButtons.set(rootId, button);
    return button;
  }

  private renderRunToolButtons(snapshot: RedesignDomSnapshot): void {
    for (const tool of snapshot.runToolButtons) {
      const button = this.runToolButtons[tool.toolId];
      const label = RUN_TOOL_VIEW[tool.toolId].name;
      const count = tool.count > 0 ? `, ${tool.count} installed` : "";
      const hotkey = tool.hotkey === null ? "" : `, key ${tool.hotkey}`;
      button.textContent = `${label}, ${tool.cost} RT${count}${hotkey}${tool.usable ? ", ready" : ", unavailable"}`;
      button.setAttribute("aria-label", `${label}, costs ${tool.cost} Run Touches${count}${hotkey}`);
      if (tool.hotkey === null) {
        button.removeAttribute("aria-keyshortcuts");
        delete button.dataset.hotkey;
      } else {
        button.setAttribute("aria-keyshortcuts", `${tool.hotkey}`);
        button.dataset.hotkey = `${tool.hotkey}`;
      }
      button.dataset.affordable = String(tool.affordable);
      button.dataset.usable = String(tool.usable);
      button.disabled = !tool.usable;
      this.positionButton(button, tool.x, tool.y, tool.width, tool.height, tool.visible);
    }
  }

  private renderRunToolBarView(snapshot: RedesignDomSnapshot): void {
    const view = snapshot.runToolBarView;
    this.runToolPreviousPageButton.textContent = `Previous tool page, ${view.page + 1} of ${view.pageCount}`;
    this.runToolPreviousPageButton.disabled = !view.previousButton.enabled;
    this.positionButton(
      this.runToolPreviousPageButton,
      view.previousButton.x,
      view.previousButton.y,
      view.previousButton.width,
      view.previousButton.height,
      view.previousButton.visible,
    );
    this.runToolNextPageButton.textContent = `Next tool page, ${view.page + 1} of ${view.pageCount}`;
    this.runToolNextPageButton.disabled = !view.nextButton.enabled;
    this.positionButton(
      this.runToolNextPageButton,
      view.nextButton.x,
      view.nextButton.y,
      view.nextButton.width,
      view.nextButton.height,
      view.nextButton.visible,
    );
  }

  private renderFieldEquipment(snapshot: RedesignDomSnapshot): void {
    for (const equipment of snapshot.fieldEquipmentButtons) {
      const button = this.fieldEquipmentButtons[equipment.equipmentId];
      const name = FIELD_EQUIPMENT[equipment.equipmentId].name;
      const status = equipment.unlocked
        ? `${equipment.owned} owned, costs ${equipment.cost} Run Touches`
        : equipment.lockReason;
      button.textContent = `Buy ${name}: ${status}`;
      button.setAttribute("aria-label", `${name}, ${status}`);
      button.dataset.unlocked = String(equipment.unlocked);
      button.dataset.affordable = String(equipment.affordable);
      button.dataset.owned = String(equipment.owned);
      button.dataset.cost = String(equipment.cost);
      button.disabled = !equipment.unlocked || !equipment.affordable || !equipment.visible;
      this.positionButton(button, equipment.x, equipment.y, equipment.width, equipment.height, equipment.visible);
    }
  }

  private renderMemoryButtons(snapshot: RedesignDomSnapshot): void {
    const visibleUpgradeIds = new Set(snapshot.memoryUpgradeButtons.map((button) => button.upgradeId));
    for (const [upgradeId, button] of this.memoryButtons) {
      if (!visibleUpgradeIds.has(upgradeId)) {
        button.remove();
        this.memoryButtons.delete(upgradeId);
      }
    }

    for (const memoryButton of snapshot.memoryUpgradeButtons) {
      const button = this.getMemoryButton(memoryButton.upgradeId);
      const label = PERMANENT_UPGRADE_DEFINITIONS[memoryButton.upgradeId].name;
      const complete = memoryButton.rank >= memoryButton.maxRank;
      const status = complete
        ? memoryButton.maxRank > 1 ? `${memoryButton.rank}/${memoryButton.maxRank} complete` : "owned"
        : !memoryButton.unlocked
          ? "path locked"
          : memoryButton.affordable
            ? `${memoryButton.maxRank > 1 ? `${memoryButton.rank}/${memoryButton.maxRank}, ` : ""}costs ${memoryButton.cost} GT, affordable`
            : `${memoryButton.maxRank > 1 ? `${memoryButton.rank}/${memoryButton.maxRank}, ` : ""}costs ${memoryButton.cost} GT, not enough GT`;
      button.textContent = `${label} ${status}`;
      button.setAttribute("aria-label", `${label} memory node`);
      button.dataset.unlocked = String(memoryButton.unlocked);
      button.dataset.affordable = String(memoryButton.affordable);
      button.dataset.owned = String(memoryButton.owned);
      button.dataset.rank = String(memoryButton.rank);
      button.dataset.maxRank = String(memoryButton.maxRank);
      button.dataset.cost = String(memoryButton.cost);
      button.disabled = !memoryButton.visible;
      button.setAttribute("aria-disabled", String(complete || !memoryButton.affordable));
      this.positionButton(button, memoryButton.x, memoryButton.y, memoryButton.width, memoryButton.height, memoryButton.visible && snapshot.metaScreenVisible);
    }
  }

  private getMemoryButton(upgradeId: PermanentUpgradeId): HTMLButtonElement {
    const existing = this.memoryButtons.get(upgradeId);
    if (existing) {
      return existing;
    }

    const button = this.createButton(
      `redesign-memory-${upgradeId}`,
      PERMANENT_UPGRADE_DEFINITIONS[upgradeId].name,
      () => this.actions.purchaseMemory(upgradeId),
    );
    button.classList.add("grass-agent-memory-button");
    button.dataset.upgradeId = upgradeId;
    const preview = () => this.actions.previewMemory(upgradeId);
    const clearPreview = () => this.actions.clearMemoryPreview(upgradeId);
    button.addEventListener("pointerenter", preview);
    button.addEventListener("mouseover", preview);
    button.addEventListener("focus", preview);
    button.addEventListener("pointerleave", clearPreview);
    button.addEventListener("mouseout", clearPreview);
    button.addEventListener("blur", clearPreview);
    button.addEventListener("wheel", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY > 0) {
        this.actions.zoomMemoryTreeOut();
      } else if (event.deltaY < 0) {
        this.actions.zoomMemoryTreeIn();
      }
    });
    this.memoryButtons.set(upgradeId, button);
    return button;
  }

  private renderLockedNodes(snapshot: RedesignDomSnapshot): void {
    const visibleTitles = new Set(snapshot.lockedMetaNodes.map((node) => node.title));
    for (const [title, button] of this.lockedNodeButtons) {
      if (!visibleTitles.has(title)) {
        button.remove();
        this.lockedNodeButtons.delete(title);
      }
    }

    for (const node of snapshot.lockedMetaNodes) {
      const button = this.getLockedNodeButton(node.title);
      button.textContent = `${node.title} locked`;
      button.setAttribute("aria-label", `${node.title} locked branch`);
      button.disabled = true;
      this.positionButton(button, node.x, node.y, node.width, node.height, node.visible && snapshot.metaScreenVisible);
    }
  }

  private getLockedNodeButton(title: string): HTMLButtonElement {
    const existing = this.lockedNodeButtons.get(title);
    if (existing) {
      return existing;
    }

    const button = this.createButton(`redesign-locked-${toTestIdSlug(title)}`, `${title} locked`, () => undefined);
    button.classList.add("grass-agent-locked-node");
    this.lockedNodeButtons.set(title, button);
    return button;
  }

  private renderNextRunButton(snapshot: RedesignDomSnapshot): void {
    this.nextRunButton.disabled = !snapshot.nextRunButton.visible || !snapshot.metaScreenVisible;
    this.positionButton(
      this.nextRunButton,
      snapshot.nextRunButton.x,
      snapshot.nextRunButton.y,
      snapshot.nextRunButton.width,
      snapshot.nextRunButton.height,
      snapshot.nextRunButton.visible && snapshot.metaScreenVisible,
    );
  }

  private renderMemoryTreeView(snapshot: RedesignDomSnapshot): void {
    this.layer.dataset.memoryTreeDragging = String(snapshot.memoryTreeView.dragging);
    this.layer.dataset.memoryTreeZoom = snapshot.memoryTreeView.zoom.toFixed(2);
    const controls: Array<[HTMLButtonElement, RedesignDomButtonBounds]> = [
      [this.memoryTreeZoomOutButton, snapshot.memoryTreeView.zoomOutButton],
      [this.memoryTreeZoomResetButton, snapshot.memoryTreeView.resetButton],
      [this.memoryTreeZoomInButton, snapshot.memoryTreeView.zoomInButton],
    ];
    for (const [button, bounds] of controls) {
      button.disabled = !bounds.enabled;
      this.positionButton(button, bounds.x, bounds.y, bounds.width, bounds.height, bounds.visible);
    }
    this.memoryTreeZoomResetButton.textContent = `Reset tree view (${Math.round(snapshot.memoryTreeView.zoom * 100)}%)`;
  }

  private renderOptions(snapshot: RedesignDomSnapshot): void {
    this.layer.dataset.optionsVisible = String(snapshot.options.visible);
    this.optionsButton.disabled = !snapshot.options.openButton.enabled;
    this.positionButton(
      this.optionsButton,
      snapshot.options.openButton.x,
      snapshot.options.openButton.y,
      snapshot.options.openButton.width,
      snapshot.options.openButton.height,
      snapshot.options.openButton.visible,
    );

    this.optionsCloseButton.disabled = !snapshot.options.closeButton.enabled;
    this.positionButton(
      this.optionsCloseButton,
      snapshot.options.closeButton.x,
      snapshot.options.closeButton.y,
      snapshot.options.closeButton.width,
      snapshot.options.closeButton.height,
      snapshot.options.closeButton.visible,
    );

    const musicToggleBounds = snapshot.options.musicEnabled ? snapshot.options.musicOffButton : snapshot.options.musicOnButton;
    const musicToggleLabel = snapshot.options.musicEnabled ? "Turn Music Off" : "Turn Music On";
    this.musicToggleAction = snapshot.options.musicEnabled ? "turn-off" : "turn-on";
    this.musicToggleButton.dataset.testid = snapshot.options.musicEnabled ? "redesign-music-off-button" : "redesign-music-on-button";
    this.musicToggleButton.dataset.musicEnabled = String(snapshot.options.musicEnabled);
    this.musicToggleButton.textContent = musicToggleLabel;
    this.musicToggleButton.setAttribute("aria-label", musicToggleLabel);
    this.musicToggleButton.disabled = !musicToggleBounds.enabled;
    this.positionButton(
      this.musicToggleButton,
      musicToggleBounds.x,
      musicToggleBounds.y,
      musicToggleBounds.width,
      musicToggleBounds.height,
      musicToggleBounds.visible,
    );

    this.sfxTestButton.disabled = !snapshot.options.sfxTestButton.enabled;
    this.positionButton(
      this.sfxTestButton,
      snapshot.options.sfxTestButton.x,
      snapshot.options.sfxTestButton.y,
      snapshot.options.sfxTestButton.width,
      snapshot.options.sfxTestButton.height,
      snapshot.options.sfxTestButton.visible,
    );

    this.musicVolumeRange.value = String(Math.round(snapshot.options.musicVolume * 100));
    this.musicVolumeRange.dataset.musicVolume = String(snapshot.options.musicVolume);
    this.musicVolumeRange.disabled = !snapshot.options.visible;
    this.positionRange(
      this.musicVolumeRange,
      snapshot.options.musicVolumeSlider.x,
      snapshot.options.musicVolumeSlider.y,
      snapshot.options.musicVolumeSlider.width,
      snapshot.options.musicVolumeSlider.height,
      snapshot.options.musicVolumeSlider.visible,
    );

    this.sfxVolumeRange.value = String(Math.round(snapshot.options.sfxVolume * 100));
    this.sfxVolumeRange.dataset.sfxVolume = String(snapshot.options.sfxVolume);
    this.sfxVolumeRange.disabled = !snapshot.options.visible;
    this.positionRange(
      this.sfxVolumeRange,
      snapshot.options.sfxVolumeSlider.x,
      snapshot.options.sfxVolumeSlider.y,
      snapshot.options.sfxVolumeSlider.width,
      snapshot.options.sfxVolumeSlider.height,
      snapshot.options.sfxVolumeSlider.visible,
    );
  }

  private renderPlaytest(snapshot: RedesignDomSnapshot): void {
    this.layer.dataset.playtest = String(snapshot.playtest.enabled);
    this.playtestPanel.hidden = !snapshot.playtest.enabled;
    if (!snapshot.playtest.enabled) {
      return;
    }

    this.playtestStatus.textContent = [
      snapshot.playtest.modeLabel,
      `HP ${snapshot.ancientHp.toFixed(1)} / ${snapshot.ancientMaxHp}`,
      `RT ${snapshot.runTouches}  GT ${snapshot.permanentGrassTouches}`,
      snapshot.runEnded ? "Memory Grove active" : "Run active",
    ].join(" | ");
    this.forceDormancyButton.disabled = !snapshot.playtest.canForceDormancy;
    this.grantMemoryButton.textContent = `+${snapshot.playtest.grantAmount} GT`;
    this.grantMemoryButton.disabled = false;
    this.restartRunButton.disabled = !snapshot.playtest.canRestartRun;
    this.resetMemoryButton.disabled = !snapshot.playtest.canResetMemory;
  }

  private positionButton(button: HTMLButtonElement, x: number, y: number, width: number, height: number, visible: boolean): void {
    button.hidden = !visible;
    if (!visible) {
      return;
    }

    button.style.left = `${Math.round(x - width / 2)}px`;
    button.style.top = `${Math.round(y - height / 2)}px`;
    button.style.width = `${Math.round(width)}px`;
    button.style.height = `${Math.round(height)}px`;
  }

  private positionRange(input: HTMLInputElement, x: number, y: number, width: number, height: number, visible: boolean): void {
    input.hidden = !visible;
    if (!visible) {
      return;
    }

    input.style.left = `${Math.round(x - width / 2)}px`;
    input.style.top = `${Math.round(y - height / 2)}px`;
    input.style.width = `${Math.round(width)}px`;
    input.style.height = `${Math.round(height)}px`;
  }
}

function toTestIdSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
