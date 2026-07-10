export const BUILD_DATE = typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : new Date().toISOString().slice(0, 10);

export const BUILD_LABEL = `Alpha 2.0 build ${BUILD_DATE}`;
export const REDESIGN_ALPHA_LABEL = `ALPHA TEST // ${BUILD_DATE}`;
