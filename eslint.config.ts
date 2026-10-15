import type { Linter } from "eslint";
import next from "eslint-config-next";

const config: Linter.Config[] = [
  { ignores: [".next/", "out/", "node_modules/", ".wrangler/", "playwright-report/", "test-results/"] },
  ...next,
];

export default config;
