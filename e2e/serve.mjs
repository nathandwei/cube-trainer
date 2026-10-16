// Serves the built app (dist/client) for the layout checks, with the SPA fallback the Worker gives. The API is mocked
// in the browser by the tests, so nothing else runs.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../dist/client/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4317);
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://local").pathname));
  let file = join(root, path);
  if (!file.startsWith(root)) file = join(root, "index.html");
  try {
    if (!(await stat(file)).isFile()) file = join(root, "index.html");
  } catch {
    file = join(root, "index.html");
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  response.end(await readFile(file));
}).listen(port, () => console.log(`layout checks: serving ${root} on ${port}`));
