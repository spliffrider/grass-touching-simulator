export interface EcosystemTitleLayout {
  phone: boolean;
  compact: boolean;
  centered: boolean;
  titleX: number;
  titleTopY: number;
  titleBottomY: number;
  chapterY: number;
  titleMaxWidth: number;
  titleTopFontSize: number;
  titleBottomFontSize: number;
  chapterFontSize: number;
  alphaFontSize: number;
  titleBlockBottom: number;
  panelX: number;
  panelY: number;
  panelTop: number;
  panelWidth: number;
  panelHeight: number;
  saveStateY: number;
  saveDetailY: number;
  buttonWidth: number;
  buttonHeight: number;
  buttonFirstY: number;
  buttonStep: number;
  buttonLabelFontSize: number;
  buttonDetailFontSize: number;
  selectorSize: number;
}

export function getEcosystemTitleLayout(
  width: number,
  height: number,
  buttonCount: number,
): EcosystemTitleLayout {
  const safeWidth = Math.max(320, width);
  const safeHeight = Math.max(480, height);
  const phone = safeWidth < 620;
  const short = safeHeight < 680;
  const compact = phone || safeWidth < 1180 || safeHeight < 780;
  const centered = compact;

  const titleTopFontSize = phone
    ? short ? 32 : 40
    : compact
      ? short ? 42 : 52
      : 62;
  const titleBottomFontSize = phone
    ? short ? 30 : 37
    : compact
      ? short ? 39 : 48
      : 57;
  const chapterFontSize = phone ? 12 : compact ? 16 : 18;
  const alphaFontSize = phone ? 9 : compact ? 10 : 11;
  const titleX = centered ? safeWidth / 2 : Math.min(safeWidth * 0.29, 520);
  const titleTopY = phone
    ? short ? 40 : 52
    : compact
      ? short ? 48 : 56
      : Math.max(74, safeHeight * 0.1);
  const titleBottomY = titleTopY + titleTopFontSize * 0.96;
  const chapterY = titleBottomY + titleBottomFontSize * 0.88;
  const titleMaxWidth = phone
    ? safeWidth - 28
    : centered
      ? Math.min(safeWidth - 56, 760)
      : Math.min(safeWidth * 0.48, 760);
  const titleBlockBottom = chapterY + Math.max(chapterFontSize, alphaFontSize + 8) / 2;

  const panelWidth = phone
    ? Math.min(safeWidth - 24, 430)
    : Math.min(safeWidth - 56, compact ? 500 : 520);
  const buttonHeight = phone ? short ? 46 : 52 : compact ? 52 : 56;
  const buttonFirstOffset = phone ? short ? 94 : 106 : compact ? 108 : 116;
  const panelBottomPadding = phone ? 20 : 22;
  const minimumButtonStep = buttonHeight + (phone ? 8 : 10);
  const minimumPanelHeight = buttonFirstOffset
    + buttonHeight / 2
    + Math.max(0, buttonCount - 1) * minimumButtonStep
    + buttonHeight / 2
    + panelBottomPadding;
  const preferredPanelHeight = short ? 350 : phone ? 400 : compact ? 402 : 430;
  const panelMinimumTop = titleBlockBottom + (phone ? 18 : 22);
  const viewportBottomPadding = phone ? 16 : 20;
  const availableHeight = Math.max(
    minimumPanelHeight,
    safeHeight - panelMinimumTop - viewportBottomPadding,
  );
  const panelHeight = Math.min(
    Math.max(minimumPanelHeight, preferredPanelHeight),
    availableHeight,
  );
  const spareHeight = Math.max(0, availableHeight - panelHeight);
  const panelTopOffset = Math.min(centered ? 66 : 42, Math.max(12, spareHeight * 0.35));
  const panelTop = Math.min(
    safeHeight - panelHeight - viewportBottomPadding,
    panelMinimumTop + panelTopOffset,
  );
  const panelX = centered ? safeWidth / 2 : titleX;
  const panelY = panelTop + panelHeight / 2;
  const buttonFirstY = panelTop + buttonFirstOffset;
  const buttonStep = buttonCount > 1
    ? (panelHeight - buttonFirstOffset - buttonHeight / 2 - panelBottomPadding)
      / (buttonCount - 1)
    : 0;

  return {
    phone,
    compact,
    centered,
    titleX,
    titleTopY,
    titleBottomY,
    chapterY,
    titleMaxWidth,
    titleTopFontSize,
    titleBottomFontSize,
    chapterFontSize,
    alphaFontSize,
    titleBlockBottom,
    panelX,
    panelY,
    panelTop,
    panelWidth,
    panelHeight,
    saveStateY: panelTop + (phone ? 31 : 34),
    saveDetailY: panelTop + (phone ? 54 : 58),
    buttonWidth: panelWidth - (phone ? 36 : 54),
    buttonHeight,
    buttonFirstY,
    buttonStep,
    buttonLabelFontSize: phone ? short ? 17 : 19 : compact ? 21 : 23,
    buttonDetailFontSize: phone ? 9 : 10,
    selectorSize: phone ? 26 : compact ? 32 : 36,
  };
}
