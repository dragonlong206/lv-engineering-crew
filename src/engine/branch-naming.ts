import type { Config } from '../types.js';

export const PLACEHOLDER = '{ticket_id}';

export const DEFAULT_BRANCH_TYPES: Record<string, string> = {
  feature: `lv/${PLACEHOLDER}`,
};

export interface BranchMatch {
  type: string;
  ticketId: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getBranchTypes(config: Config): Record<string, string> {
  return config.branch_types ?? DEFAULT_BRANCH_TYPES;
}

/** Render a branch name for the given ticket ID and type (defaults to config.default_branch_type). */
export function renderBranchName(config: Config, ticketId: string, type?: string): string {
  const types = getBranchTypes(config);
  const branchType = type ?? config.default_branch_type;
  const pattern = types[branchType];
  if (!pattern) {
    throw new Error(`Unknown branch type '${branchType}'. Configured types: ${Object.keys(types).join(', ')}`);
  }
  return pattern.replace(PLACEHOLDER, ticketId);
}

/** Match an arbitrary branch name against all configured branch types, extracting its ticket ID. */
export function matchBranch(config: Config, branchName: string): BranchMatch | null {
  const types = getBranchTypes(config);
  for (const [type, pattern] of Object.entries(types)) {
    if (!pattern.includes(PLACEHOLDER)) continue;
    const regex = new RegExp(`^${pattern.split(PLACEHOLDER).map(escapeRegExp).join('(.+)')}$`);
    const match = branchName.match(regex);
    if (match) return { type, ticketId: match[1] };
  }
  return null;
}

/** Git ref globs (one per branch type) matching any ticket ID, for listing existing ticket branches. */
export function branchGlobs(config: Config): string[] {
  const types = getBranchTypes(config);
  return Object.values(types)
    .filter((pattern) => pattern.includes(PLACEHOLDER))
    .map((pattern) => pattern.replace(PLACEHOLDER, '*'));
}
