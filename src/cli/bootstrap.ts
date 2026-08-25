import fs from "fs";
import path from "path";
import {
  loadConfig,
  getRepoRoot,
  getFeaturesDir,
  getModelForStep,
} from "../config.js";
import { Agent } from "@mastra/core/agent";
import { printInfo, printSuccess, printError, printWarn, writeFile, extractText, extractJson } from "./helpers.js";
import {
  AUTO_GENERATED_HEADER,
  buildBootstrapOverviewPrompt,
  buildBootstrapDesignPrompt,
  buildBootstrapRequirementsPrompt,
  buildBootstrapScanPrompt,
} from "../prompts.js";
import { listCodeFiles } from "../tools/codebase.js";
import { createBootstrapScanAgent } from "../agents/bootstrap-agent.js";
import type { Config } from "../types.js";

const bootstrapAgent = new Agent({
  id: "lv-bootstrap-agent",
  name: "LV Bootstrap Agent",
  model: "openai/gpt-4o-mini",
  instructions: "You are a documentation generation assistant. Follow the user's prompt exactly and return only the requested content.",
});

export interface BootstrapScanHint {
  name?: string;
  description?: string;
}

export async function runBootstrap(
  featureId: string,
  pathsArg?: string,
  hint?: BootstrapScanHint,
): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  if (pathsArg) {
    if (hint?.name || hint?.description) {
      printWarn("--name/--description are ignored when --paths is provided.");
    }
    await runBootstrapFromPaths(config, repoRoot, featureId, pathsArg);
  } else {
    await runBootstrapFromScan(config, repoRoot, featureId, hint);
  }
}

async function runBootstrapFromPaths(
  config: Config,
  repoRoot: string,
  featureId: string,
  pathsArg: string,
): Promise<void> {
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
      const files = listCodeFiles(absPath, config.scan_extensions, config.scan_skip_dirs).slice(0, 50); // limit
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

  const [overviewResult, designResult, requirementsResult] = await Promise.all([
    bootstrapAgent.generate(buildBootstrapOverviewPrompt(featureId, codeBlock), { model }),
    bootstrapAgent.generate(buildBootstrapDesignPrompt(featureId, codeBlock), { model }),
    bootstrapAgent.generate(buildBootstrapRequirementsPrompt(featureId, codeBlock), { model }),
  ]);

  const overviewText = extractText(overviewResult);
  const designText = extractText(designResult);
  const requirementsText = extractText(requirementsResult);

  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  fs.mkdirSync(featureDir, { recursive: true });

  writeFile(
    path.join(featureDir, "overview.md"),
    AUTO_GENERATED_HEADER + overviewText,
  );
  writeFile(path.join(featureDir, "design.md"), AUTO_GENERATED_HEADER + designText);
  writeFile(path.join(featureDir, "requirements.md"), AUTO_GENERATED_HEADER + requirementsText);

  updateIndex(repoRoot, featureId);

  printSuccess(`Generated docs for '${featureId}'.`);
  console.log(`\nFiles written (not committed):`);
  console.log(`  ${path.join(featureDir, "overview.md")}`);
  console.log(`  ${path.join(featureDir, "design.md")}`);
  console.log(`  ${path.join(featureDir, "requirements.md")}`);
  console.log(`\nReview, edit, then commit manually.`);
}

export interface GeneratedFeatureDocs {
  featureDir: string;
  overviewPath: string;
  designPath: string;
  requirementsPath: string;
}

/**
 * Core of bootstrap's autonomous-scan mode, without any CLI printing — shared by
 * `runBootstrapFromScan` (below) and `lv start`'s inline feature bootstrap.
 */
export async function generateFeatureDocsFromScan(
  config: Config,
  repoRoot: string,
  featureId: string,
  hint?: BootstrapScanHint,
): Promise<GeneratedFeatureDocs> {
  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  const overviewPath = path.join(featureDir, "overview.md");
  const designPath = path.join(featureDir, "design.md");
  const requirementsPath = path.join(featureDir, "requirements.md");

  const existingOverview = fs.existsSync(overviewPath)
    ? fs.readFileSync(overviewPath, "utf-8")
    : undefined;
  const existingDesign = fs.existsSync(designPath)
    ? fs.readFileSync(designPath, "utf-8")
    : undefined;
  const existingRequirements = fs.existsSync(requirementsPath)
    ? fs.readFileSync(requirementsPath, "utf-8")
    : undefined;

  const model = getModelForStep(config, "bootstrap");
  const prompt = buildBootstrapScanPrompt(
    featureId,
    repoRoot,
    existingOverview,
    existingDesign,
    hint?.name,
    hint?.description,
    existingRequirements,
  );
  const scanAgent = createBootstrapScanAgent(config.scan_extensions, config.scan_skip_dirs);
  const result = await scanAgent.generate(prompt, { model, maxSteps: 18 });
  const text = extractText(result);
  const parsed = extractJson<{ overviewMarkdown: string; designMarkdown: string; requirementsMarkdown: string }>(text);

  fs.mkdirSync(featureDir, { recursive: true });
  writeFile(overviewPath, AUTO_GENERATED_HEADER + parsed.overviewMarkdown);
  writeFile(designPath, AUTO_GENERATED_HEADER + parsed.designMarkdown);
  writeFile(requirementsPath, AUTO_GENERATED_HEADER + parsed.requirementsMarkdown);

  updateIndex(repoRoot, featureId);

  return { featureDir, overviewPath, designPath, requirementsPath };
}

async function runBootstrapFromScan(
  config: Config,
  repoRoot: string,
  featureId: string,
  hint?: BootstrapScanHint,
): Promise<void> {
  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  const alreadyExists = fs.existsSync(path.join(featureDir, "overview.md"));

  printInfo(`Scanning codebase to ${alreadyExists ? "refine" : "generate"} docs for feature '${featureId}'...`);

  const { overviewPath, designPath, requirementsPath } = await generateFeatureDocsFromScan(
    config,
    repoRoot,
    featureId,
    hint,
  );

  printSuccess(`Generated docs for '${featureId}' from codebase scan.`);
  console.log(`\nFiles written (not committed):`);
  console.log(`  ${overviewPath}`);
  console.log(`  ${designPath}`);
  console.log(`  ${requirementsPath}`);
  console.log(`\nReview, edit, then commit manually.`);
}

export function updateIndex(repoRoot: string, featureId: string): void {
  const indexFile = path.join(getFeaturesDir(repoRoot), "INDEX.md");
  const line = `- [${featureId}](./${featureId}/overview.md)`;

  if (!fs.existsSync(indexFile)) {
    writeFile(indexFile, `# Feature Index\n\n${line}\n`);
    return;
  }

  const content = fs.readFileSync(indexFile, "utf-8");
  if (content.includes(line) || content.includes(`[${featureId}]`)) return;

  fs.appendFileSync(indexFile, `${line}\n`);
}
