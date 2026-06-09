import { defineConfig } from "vite";

function getBuildDate(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Brussels",
    year: "numeric",
  }).formatToParts(new Date());
  const getPart = (type: string): string => parts.find((part) => part.type === type)?.value ?? "00";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify(getBuildDate()),
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }

          return undefined;
        },
      },
    },
  },
});
