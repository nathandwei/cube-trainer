import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The Cloudflare plugin runs worker/index.ts (the /api routes) and the SPA together in dev and in the build.
  plugins: [react(), cloudflare()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // cubing.js runs its scramble and search code in module workers.
  worker: { format: "es" },
  build: {
    target: "es2022",
    // Vite's preload helper touches `document`, and cubing.js loads its search code inside a worker.
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Keep cubing.js's own chunk boundaries. Its search worker imports some of these modules; if
              // the bundler folds them into the app's entry chunk, the worker evaluates the whole app and
              // dies on `document`.
              debugName: "cubing",
              name: (id: string) => {
                const file = /cubing[\\/]dist[\\/]lib[\\/]cubing[\\/](.+?)\.js$/.exec(id)?.[1];
                return file ? `cubing-${file.replace(/[\\/]/g, "-")}` : null;
              },
            },
          ],
        },
      },
    },
  },
});
