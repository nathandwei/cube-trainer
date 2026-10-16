import { defineConfig } from "@playwright/test";

const PORT = 4317;

// Layout checks on the built app (pnpm build first, or pnpm test:layout): see e2e/layout.spec.ts.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Software WebGL, so the 3D cube draws on machines and CI without a GPU.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: { command: `PORT=${PORT} node e2e/serve.mjs`, port: PORT, reuseExistingServer: true },
});
