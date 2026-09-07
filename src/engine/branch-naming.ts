import type { Config } from '../types.js';
import { listBranchesMatching } from '../integrations/git/client.js';

export const TICKET_PLACEHOLDER = '{ticket_id}';
export const SUMMARY_PLACEHOLDER = '{summary}';

export const DEFAULT_BRANCH_TYPES: Record<string, string> = {
  feature: `feature/${TICKET_PLACEHOLDER}-${SUMMARY_PLACEHOLDER}`,
  hotfix: `hotfix/${TICKET_PLACEHOLDER}-${SUMMARY_PLACEHOLDER}`,
};

export interface BranchMatch {
  type: string;
  ticketId: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lowercase, ASCII, hyphen-separated slug for embedding a ticket title in a branch name. */
export function slugify(text: string, maxLength = 50): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

/** Unwraps a `branch_types` entry (plain pattern string, or `{ pattern, base_branch? }`) to its naming pattern. */
function patternOf(entry: string | { pattern: string; base_branch?: string }): string {
  return typeof entry === "string" ? entry : entry.pattern;
}

export function getBranchTypes(config: Config): Record<string, string> {
  const types = config.branch_types ?? DEFAULT_BRANCH_TYPES;
  return Object.fromEntries(
    Object.entries(types).map(([type, entry]) => [type, patternOf(entry)]),
  );
}

/**
 * The base branch to create/recreate `type`'s branches from — its configured `base_branch`
 * if set (only possible for the `{ pattern, base_branch? }` object form), else `config.default_branch`.
 */
export function resolveBaseBranch(config: Config, type: string): string {
  const entry = config.branch_types?.[type];
  if (entry && typeof entry === "object" && entry.base_branch) {
    return entry.base_branch;
  }
  return config.default_branch;
}

/** Render a branch name for the given ticket ID and type (defaults to config.default_branch_type). */
export function renderBranchName(
  config: Config,
  ticketId: string,
  opts: { type?: string; summary?: string } = {},
): string {
  const types = getBranchTypes(config);
  const branchType = opts.type ?? config.default_branch_type;
  const pattern = types[branchType];
  if (!pattern) {
    throw new Error(`Unknown branch type '${branchType}'. Configured types: ${Object.keys(types).join(', ')}`);
  }

  let name = pattern.replace(TICKET_PLACEHOLDER, ticketId);

  const summarySlug = opts.summary ? slugify(opts.summary) : '';
  name = summarySlug
    ? name.replace(SUMMARY_PLACEHOLDER, summarySlug)
    // No summary available (e.g. lv resume's best-effort guess) — drop the
    // placeholder and one adjacent separator so we don't leave a trailing "-".
    : name.replace(new RegExp(`[-_/]?${escapeRegExp(SUMMARY_PLACEHOLDER)}`), '');

  return name;
}

/**
 * Builds a regex for a branch_types pattern. {ticket_id} is captured non-greedily, so
 * "feature/recu0f3-add-login-button" splits at the first "-" — correct as long as ticket
 * IDs themselves don't contain the separator between the two placeholders (true for Lark
 * Bitable record IDs, which are plain alphanumeric). A literal immediately followed by
 * {summary} is wrapped as optional, so a summary-less name (e.g. renderBranchName's
 * best-effort guess when no ticket title is available) still matches.
 */
function patternToRegex(pattern: string): { regex: RegExp; ticketGroup: number } {
  const tokens = pattern
    .split(new RegExp(`(${escapeRegExp(TICKET_PLACEHOLDER)}|${escapeRegExp(SUMMARY_PLACEHOLDER)})`))
    .filter((t) => t !== '');

  let regexStr = '^';
  let ticketGroup = -1;
  let groupCount = 0;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token === TICKET_PLACEHOLDER) {
      groupCount++;
      ticketGroup = groupCount;
      regexStr += '(.+?)';
      i++;
    } else if (token === SUMMARY_PLACEHOLDER) {
      groupCount++;
      regexStr += '(.+)';
      i++;
    } else if (tokens[i + 1] === SUMMARY_PLACEHOLDER) {
      // Literal directly preceding {summary} — make "separator + summary" optional as a unit.
      groupCount++;
      regexStr += `(?:${escapeRegExp(token)}(.+))?`;
      i += 2;
    } else {
      regexStr += escapeRegExp(token);
      i++;
    }
  }
  regexStr += '$';

  return { regex: new RegExp(regexStr), ticketGroup };
}

/** Match an arbitrary branch name against all configured branch types, extracting its ticket ID. */
export function matchBranch(config: Config, branchName: string): BranchMatch | null {
  const types = getBranchTypes(config);
  for (const [type, pattern] of Object.entries(types)) {
    if (!pattern.includes(TICKET_PLACEHOLDER)) continue;
    const { regex, ticketGroup } = patternToRegex(pattern);
    const match = branchName.match(regex);
    if (match) return { type, ticketId: match[ticketGroup] };
  }
  return null;
}

/**
 * Git ref globs (one per branch type) matching any ticket ID, for listing existing ticket
 * branches. Only the literal prefix up to {ticket_id} is kept, with a single trailing `*` —
 * not a glob per-placeholder — because renderBranchName() drops the separator before {summary}
 * entirely when no summary is given (e.g. every description-based start's branch), so a glob
 * that requires that separator's literal text would never match those branches. matchBranch()
 * does the precise filtering afterward, so over-matching here (e.g. an unrelated branch that
 * happens to share the prefix) is harmless.
 */
export function branchGlobs(config: Config): string[] {
  const types = getBranchTypes(config);
  return Object.values(types)
    .filter((pattern) => pattern.includes(TICKET_PLACEHOLDER))
    .map((pattern) => `${pattern.slice(0, pattern.indexOf(TICKET_PLACEHOLDER))}*`);
}

/**
 * All branches (local or on origin) belonging to the given change ID, across every configured
 * branch type — ignores `{summary}` (and which `{type}` was used) so it finds a change's branch
 * regardless of how it was originally named. Shared by `lv resume` (to check out a change's
 * branch) and `lv start` (to detect an already-existing branch before creating one).
 */
export async function findChangeBranches(
  repoRoot: string,
  config: Config,
  changeId: string,
): Promise<string[]> {
  const all = await listBranchesMatching(repoRoot, branchGlobs(config));
  return all.filter((b) => matchBranch(config, b)?.ticketId === changeId);
}
