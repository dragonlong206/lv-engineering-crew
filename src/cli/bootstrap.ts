import fs from "fs";
import path from "path";
import { loadConfig, getRepoRoot, getFeaturesDir } from "../config.js";
import { printInfo, printSuccess, printError, printWarn, writeFile } from "./helpers.js";
import {
  AUTO_GENERATED_HEADER,
  buildBootstrapPlaceholderOverview,
  buildBootstrapPlaceholderDesign,
} from "../prompts.js";
import {
  listCodeFiles,
  DEFAULT_CODE_EXTENSIONS,
  DEFAULT_SKIP_DIRS,
} from "../tools/codebase.js";
import { getTenantAccessToken, syncFeatureToLarkTable } from "../tools/lark.js";
import type { Config } from "../types.js";

export interface BootstrapScanHint {
  name?: string;
  description?: string;
}

/**
 * Fetches a Lark tenant token and syncs a feature to the configured Features table, when that
 * sync is actually configured — skipping the token fetch entirely otherwise. Called
 * unconditionally after (re)generating a feature's docs, regardless of whether its docs
 * directory already existed: `syncFeatureToLarkTable()` checks Lark itself for an existing
 * record, so this also backfills a feature whose docs predate `features_table_id` being
 * configured or whose Lark write previously failed. Called directly by `lv bootstrap`'s
 * placeholder and `--finalize` modes; `lv start`'s inline bootstrap instead calls
 * `syncFeatureToLarkTable()` itself, since it already holds a token from its own run.
 */
async function syncNewFeatureToLark(
  config: Config,
  featureId: string,
  title: string,
): Promise<void> {
  if (!config.lark.features_table_id || !config.lark.sync_new_features) return;
  if (!config.lark_app_id || !config.lark_app_secret) {
    printWarn(
      `Skipping Lark Features table sync for '${featureId}': missing lark_app_id/lark_app_secret.`,
    );
    return;
  }

  const larkToken = await getTenantAccessToken(
    config.lark_app_id,
    config.lark_app_secret,
  );
  await syncFeatureToLarkTable(config, larkToken, featureId, title);
}

export interface BootstrapOpts {
  newFeature?: boolean;
  context?: boolean;
  finalize?: boolean;
  title?: string;
}

export async function runBootstrap(
  featureId: string,
  pathsArg?: string,
  hint?: BootstrapScanHint,
  opts?: BootstrapOpts,
): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  if (opts?.newFeature) {
    if (pathsArg || hint?.name || hint?.description) {
      printWarn(
        "--paths/--name/--description are ignored when --new-feature is set.",
      );
    }
    await runBootstrapPlaceholder(config, repoRoot, featureId);
    return;
  }

  if (opts?.context) {
    runBootstrapContext(config, repoRoot, featureId, pathsArg, hint);
    return;
  }

  if (opts?.finalize) {
    if (!opts.title) {
      printError("--finalize requires --title <title>.");
      process.exit(1);
    }
    await runBootstrapFinalize(config, repoRoot, featureId, opts.title);
    return;
  }

  printError(
    `'lv bootstrap ${featureId}' with no flags no longer generates docs directly. Run the 'lv-bootstrap' skill/command from your coding agent (Claude Code, Cursor, etc.) instead, or use 'lv bootstrap ${featureId} --new-feature' for placeholder-only docs.`,
  );
  process.exit(1);
}

/**
 * Expands `--paths` into a capped list of repo-relative file paths (recursing into any given
 * directory, same 50-file-per-directory cap as before) — file *contents* are deliberately not
 * read here; the calling coding agent reads whichever of these paths it needs with its own
 * tools. See design.md Decision 1/2.
 */
function expandBootstrapPaths(
  repoRoot: string,
  pathsArg: string,
  scanExtensions: string[],
  scanSkipDirs: string[],
): string[] {
  const rawPaths = pathsArg
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (rawPaths.length === 0) {
    printError("No paths provided. Use --paths <path1,path2,...>");
    process.exit(1);
  }

  const resolved: string[] = [];
  for (const rawPath of rawPaths) {
    const absPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.join(repoRoot, rawPath);
    if (!fs.existsSync(absPath)) {
      printError(`Path not found: ${absPath}`);
      process.exit(1);
    }

    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      const files = listCodeFiles(absPath, scanExtensions, scanSkipDirs).slice(
        0,
        50,
      ); // limit
      resolved.push(...files.map((f) => path.relative(repoRoot, f)));
    } else {
      resolved.push(path.relative(repoRoot, absPath));
    }
  }

  return resolved;
}

interface BootstrapContextOutput {
  repoRoot: string;
  overviewPath: string;
  designPath: string;
  scanExtensions: string[];
  scanSkipDirs: string[];
  outputLanguage?: string;
  existingOverviewMarkdown?: string;
  existingDesignMarkdown?: string;
  paths?: string[];
  name?: string;
  description?: string;
}

/**
 * `--context`: no LLM call. Assembles the same inputs the old Mastra-agent prompts used to
 * package (repo root, existing drafts, scan config, `--paths` expansion, feature hint) and
 * prints them as JSON for the `lv-bootstrap` skill/command to consume — see design.md Decision
 * 1/2. Creates the feature directory so the skill can write into it immediately afterward.
 */
function runBootstrapContext(
  config: Config,
  repoRoot: string,
  featureId: string,
  pathsArg?: string,
  hint?: BootstrapScanHint,
): void {
  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  fs.mkdirSync(featureDir, { recursive: true });

  const overviewPath = path.join(featureDir, "overview.md");
  const designPath = path.join(featureDir, "design.md");

  const existingOverviewMarkdown = fs.existsSync(overviewPath)
    ? fs.readFileSync(overviewPath, "utf-8")
    : undefined;
  const existingDesignMarkdown = fs.existsSync(designPath)
    ? fs.readFileSync(designPath, "utf-8")
    : undefined;

  const scanExtensions = config.scan_extensions ?? DEFAULT_CODE_EXTENSIONS;
  const scanSkipDirs = config.scan_skip_dirs ?? DEFAULT_SKIP_DIRS;

  const paths = pathsArg
    ? expandBootstrapPaths(repoRoot, pathsArg, scanExtensions, scanSkipDirs)
    : undefined;

  const output: BootstrapContextOutput = {
    repoRoot,
    overviewPath,
    designPath,
    scanExtensions,
    scanSkipDirs,
    outputLanguage: config.output_language,
    existingOverviewMarkdown,
    existingDesignMarkdown,
    paths,
    name: hint?.name,
    description: hint?.description,
  };

  console.log(JSON.stringify(output));
}

/**
 * `--finalize`: no LLM call. Runs the same post-generation bookkeeping the old LLM-driven modes
 * used to bundle in (index update, optional Lark sync) once the `lv-bootstrap` skill/command has
 * already written `overview.md`/`design.md` itself — see design.md Decision 1/2.
 */
async function runBootstrapFinalize(
  config: Config,
  repoRoot: string,
  featureId: string,
  title: string,
): Promise<void> {
  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  const overviewPath = path.join(featureDir, "overview.md");
  const designPath = path.join(featureDir, "design.md");

  if (!fs.existsSync(overviewPath) || !fs.existsSync(designPath)) {
    printError(
      `--finalize expects '${overviewPath}' and '${designPath}' to already exist — write them first, then run --finalize.`,
    );
    process.exit(1);
  }

  updateIndex(repoRoot, featureId);
  await syncNewFeatureToLark(config, featureId, title);

  printSuccess(`Finalized docs for '${featureId}'.`);
}

export interface GeneratedFeatureDocs {
  featureDir: string;
  overviewPath: string;
  designPath: string;
}

/**
 * New-feature placeholder mode: writes heading-only `overview.md`/`design.md` for a feature
 * with no code yet — no `--paths` read, no LLM call, no codebase exploration. Shared by
 * `runBootstrap()`'s `--new-feature` flag and `lv start`'s inline feature bootstrap for a
 * referenced feature with no existing `docs/features/<id>/` directory.
 */
export function generateFeatureDocsPlaceholder(
  repoRoot: string,
  featureId: string,
): GeneratedFeatureDocs {
  const featureDir = path.join(getFeaturesDir(repoRoot), featureId);
  const overviewPath = path.join(featureDir, "overview.md");
  const designPath = path.join(featureDir, "design.md");

  fs.mkdirSync(featureDir, { recursive: true });
  writeFile(
    overviewPath,
    AUTO_GENERATED_HEADER + buildBootstrapPlaceholderOverview(featureId),
  );
  writeFile(
    designPath,
    AUTO_GENERATED_HEADER + buildBootstrapPlaceholderDesign(featureId),
  );

  updateIndex(repoRoot, featureId);

  return { featureDir, overviewPath, designPath };
}

async function runBootstrapPlaceholder(
  config: Config,
  repoRoot: string,
  featureId: string,
): Promise<void> {
  printInfo(`Writing placeholder docs for new feature '${featureId}'...`);

  const { overviewPath, designPath } = generateFeatureDocsPlaceholder(
    repoRoot,
    featureId,
  );

  await syncNewFeatureToLark(config, featureId, featureId);

  printSuccess(`Wrote placeholder docs for '${featureId}'.`);
  console.log(`\nFiles written (not committed):`);
  console.log(`  ${overviewPath}`);
  console.log(`  ${designPath}`);
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
