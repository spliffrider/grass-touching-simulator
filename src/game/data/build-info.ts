const buildDate = typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : new Date().toISOString().slice(0, 10);

export const BUILD_LABEL = `Alpha 2.0 build ${buildDate}`;
