import fs from "fs";
import path from "path";
import {
  loadConfig,
  getRepoRoot,
  getFeaturesDir,
  getModelForStep,
} from "../config.js";
import { Agent } from "@mastra/core/agent";
import { printInfo, printSuccess, printError, writeFile, extractText } from "./helpers.js";
import { BOOTSTRAP_HEADER, buildBootstrapOverviewPrompt, buildBootstrapDesignPrompt } from "../prompts.js";

const bootstrapAgent = new Agent({
  id: "lv-bootstrap-agent",
  name: "LV Bootstrap Agent",
  model: "openai/gpt-4o-mini",
});

export async function runBootstrap(
  featureId: string,
  pathsArg: string,
): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  const paths = pathsArg
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (paths.length === 0) {
    printError("No paths provided. Use --paths <path1,path2,...>");
    process.exit(1);
  }

  // Read code from all specified paths
  const codeContext: string[] = [];
  for (const rawPath of paths) {
    const absPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.join(repoRoot, rawPath);
    if (!fs.existsSync(absPath)) {
      printError(`Path not found: ${absPath}`);
      process.exit(1);
    }

    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      const files = getAllFiles(absPath).slice(0, 50); // limit
      for (const file of files) {
        const rel = path.relative(repoRoot, file);
        const content = fs.readFileSync(file, "utf-8");
        codeContext.push(`### ${rel}\n\`\`\`\n${content}\n\`\`\``);
      }
    } else {
      const rel = path.relative(repoRoot, absPath);
      const content = fs.readFileSync(absPath, "utf-8");
      codeContext.push(`### ${rel}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  const codeBlock = codeContext.join("\n\n");

  printInfo(`Generating docs for feature '${featureId}'...`);

  const model = getModelForStep(config, "bootstrap");

  const [overviewResult, designResult] = await Promise.all([
    bootstrapAgent.generate(buildBootstrapOverviewPrompt(featureId, codeBlock), { model }),
    bootstrapAgent.generate(buildBootstrapDesignPrompt(featureId, codeBlock), { model }),
  ]);

  const overviewText = extractText(overviewResult);
  const designText = extractText(designResult);

  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  fs.mkdirSync(featureDir, { recursive: true });

  writeFile(
    path.join(featureDir, "overview.md"),
    BOOTSTRAP_HEADER + overviewText,
  );
  writeFile(path.join(featureDir, "design.md"), BOOTSTRAP_HEADER + designText);

  // Update INDEX.md
  updateIndex(repoRoot, featureId);

  printSuccess(`Generated docs for '${featureId}'.`);
  console.log(`\nFiles written (not committed):`);
  console.log(`  ${path.join(featureDir, "overview.md")}`);
  console.log(`  ${path.join(featureDir, "design.md")}`);
  console.log(`\nReview, edit, then commit manually.`);
}

function getAllFiles(dir: string): string[] {
  const result: string[] = [];
  const skip = new Set([
    "node_modules",
    ".git",
    "dist",
    "__pycache__",
    ".venv",
  ]);

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        /\.(ts|js|py|go|java|rb|rs|md|yaml|yml|json)$/.test(entry.name)
      ) {
        result.push(full);
      }
    }
  }

  walk(dir);
  return result;
}

function updateIndex(repoRoot: string, featureId: string): void {
  const indexFile = path.join(getFeaturesDir(repoRoot), "INDEX.md");
  const line = `- [${featureId}](./${featureId}/overview.md)`;

  if (!fs.existsSync(indexFile)) {
    writeFile(indexFile, `# Feature Index\n\n${line}\n`);
    return;
  }

  const content = fs.readFileSync(indexFile, "utf-8");
  if (content.includes(line)) return;

  fs.appendFileSync(indexFile, `${line}\n`);
}
