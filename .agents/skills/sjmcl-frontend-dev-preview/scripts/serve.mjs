import { context } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skillDir = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(skillDir, "../../..");
const configPath = path.resolve(
  process.argv[2] || path.join(skillDir, "examples/add-server/preview.mjs")
);
const config = configPath.endsWith(".mjs")
  ? (await import(pathToFileURL(configPath).href)).default
  : { entry: configPath };
const resolveFixture = (file) => path.resolve(path.dirname(configPath), file);
const tempDir = await mkdtemp(path.join(tmpdir(), "sjmcl-preview-"));
const html = path.join(tempDir, "index.html");

await writeFile(
  html,
  `<!doctype html>
<html lang="zh-Hans">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SJMCL Frontend Preview</title>
    <link rel="stylesheet" href="/app.css">
  </head>
  <body>
    <div id="root"></div>
    <script src="/app.js"></script>
    <script>new EventSource('/esbuild').addEventListener('change', () => location.reload());</script>
  </body>
</html>`
);

const ctx = await context({
  absWorkingDir: root,
  stdin: {
    contents: `import Preview from ${JSON.stringify(resolveFixture(config.entry))};
import { mount } from ${JSON.stringify(path.join(skillDir, "scripts/runtime.tsx"))};
mount(Preview);`,
    resolveDir: root,
  },
  outfile: path.join(root, "public/app.js"),
  bundle: true,
  write: false,
  sourcemap: true,
  tsconfig: path.join(root, "tsconfig.json"),
  nodePaths: [path.join(root, "node_modules")],
  alias: Object.fromEntries(
    Object.entries(config.alias || {}).map(([name, file]) => [
      name,
      resolveFixture(file),
    ])
  ),
  external: ["/fonts/*"],
  define: { "process.env.NODE_ENV": '"development"' },
});

await ctx.watch();
const { port } = await ctx.serve({
  host: "127.0.0.1",
  port: Number(process.env.PORT || 3176),
  servedir: path.join(root, "public"),
  fallback: html,
});
console.log(`Preview: http://127.0.0.1:${port}/preview`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await ctx.dispose();
    await rm(tempDir, { recursive: true });
    process.exit();
  });
}
