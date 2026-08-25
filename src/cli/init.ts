import fs from "fs";
import path from "path";
import { loadConfig, getRepoRoot, getFeaturesDir, getModelForStep } from "../config.js";
import { Agent } from "@mastra/core/agent";
import { printInfo, printSuccess, printError, writeFile, extractText, extractJson } from "./helpers.js";
import { AUTO_GENERATED_HEADER, buildInitPrompt } from "../prompts.js";
import { allocateFeatureIds } from "../engine/feature-id.js";
import { readRequirementDoc, isUrl } from "../tools/doc-readers.js";
import { updateIndex } from "./bootstrap.js";

const initAgent = new Agent({
  id: "lv-init-agent",
  name: "LV Init Agent",
  model: "openai/gpt-4o-mini",
  instructions: "You are a documentation generation assistant. Follow the user's prompt exactly and return only the requested content.",
});

interface InitFeature {
  title: string;
  overviewMarkdown: string;
  sourceRefs: string[];
}

interface InitResult {
  features: InitFeature[];
}

export interface InitOptions {
  idPrefix?: string;
  idDigits?: string;
}

export async function runInit(docPaths: string[], opts: InitOptions): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  if (docPaths.length === 0) {
    printError("No requirement documents provided. Usage: lv init <doc1> [doc2 ...]");
    process.exit(1);
  }

  const prefix = opts.idPrefix ?? config.feature_id_prefix;
  const digits = opts.idDigits ? Number(opts.idDigits) : config.feature_id_digits;

  const docBlocks: string[] = [];
  for (const raw of docPaths) {
    if (isUrl(raw)) {
      docBlocks.push(`Reference (not fetched): ${raw}`);
      continue;
    }

    const absPath = path.isAbsolute(raw) ? raw : path.join(repoRoot, raw);
    if (!fs.existsSync(absPath)) {
      printError(`Document not found: ${absPath}`);
      process.exit(1);
    }

    const content = await readRequirementDoc(absPath);
    docBlocks.push(`--- Document: ${path.relative(repoRoot, absPath)} ---\n${content}`);
  }
  const docsBlock = docBlocks.join("\n\n");

  printInfo("Analyzing requirement documents...");

  const model = getModelForStep(config, "init");
  const result = await initAgent.generate(buildInitPrompt(docsBlock), { model });
  const parsed = extractJson<InitResult>(extractText(result));

  if (!parsed.features || parsed.features.length === 0) {
    printError("The agent did not identify any features from the provided documents.");
    process.exit(1);
  }

  const ids = allocateFeatureIds(repoRoot, parsed.features.length, prefix, digits);

  printSuccess(`Identified ${parsed.features.length} feature(s).`);
  for (let i = 0; i < parsed.features.length; i++) {
    const feature = parsed.features[i];
    const id = ids[i];
    const featureDir = path.join(getFeaturesDir(repoRoot), id);

    writeFile(path.join(featureDir, "overview.md"), AUTO_GENERATED_HEADER + feature.overviewMarkdown);
    updateIndex(repoRoot, id);

    console.log(`  ${id}: ${feature.title}`);
  }

  console.log(`\nFiles written (not committed). Review, edit, then commit manually.`);
  console.log(`Next: run 'lv bootstrap <feature-id>' to ground each overview in the actual code.`);
}
