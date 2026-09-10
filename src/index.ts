#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')) as { version: string };

const program = new Command();

program
  .name('lv')
  .description('AI-assisted spec-driven development CLI')
  .version(pkg.version);

program
  .command('start [ticket-id]')
  .description('Start a new change: from a Lark ticket ID, or from --description')
  .option('--type <type>', 'Branch type to use (default from .lv.yaml default_branch_type)')
  .option('--description <description>', 'Free-text description to start a change without a ticket')
  .action(async (ticketId: string | undefined, opts: { type?: string; description?: string }) => {
    const { runStart } = await import('./cli/start.js');
    await runStart(ticketId, opts).catch(die);
  });

program
  .command('bootstrap <feature-id>')
  .description('Generate feature docs — placeholder mode, or via the lv-bootstrap skill/command using --context/--finalize')
  .option('--paths <paths>', 'Comma-separated paths for --context to scope exploration to (optional)')
  .option('--name <name>', 'Feature name hint for --context')
  .option('--description <description>', 'Feature description hint for --context')
  .option('--new-feature', 'Skip code scanning and write placeholder-only docs for a feature with no code yet')
  .option('--context', 'Print JSON context for the lv-bootstrap skill/command to consume (no LLM call)')
  .option('--finalize', 'Update the feature index and sync Lark after the skill has written overview.md/design.md (no LLM call, requires --title)')
  .option('--title <title>', 'Feature title to use with --finalize')
  .action(async (featureId: string, opts: { paths?: string; name?: string; description?: string; newFeature?: boolean; context?: boolean; finalize?: boolean; title?: string }) => {
    const { runBootstrap } = await import('./cli/bootstrap.js');
    await runBootstrap(
      featureId,
      opts.paths,
      { name: opts.name, description: opts.description },
      { newFeature: opts.newFeature, context: opts.context, finalize: opts.finalize, title: opts.title },
    ).catch(die);
  });

program
  .command('init')
  .description('Install and configure OpenSpec for a coding agent, wired to LV context')
  .option('--tool <tool>', 'Coding agent to install OpenSpec for (passed to `openspec init --tools`; omit to choose interactively). For multiple tools, quote the comma-separated value (e.g. --tool "claude,codex") — PowerShell parses an unquoted comma itself before it reaches this CLI.')
  .action(async (opts: { tool?: string }) => {
    const { runInit } = await import('./cli/init.js');
    await runInit(opts).catch(die);
  });

program
  .command('resume [ticket-id]')
  .description('Check out a change\'s branch and print its context summary')
  .action(async (ticketId?: string) => {
    const { runResume } = await import('./cli/resume.js');
    await runResume(ticketId).catch(die);
  });

program
  .command('status')
  .description('Show current change status')
  .action(async () => {
    const { runStatus } = await import('./cli/status.js');
    await runStatus().catch(die);
  });

program
  .command('link <openspec-change-name>')
  .description('Record an OpenSpec change name against the current change')
  .action(async (openspecChangeName: string) => {
    const { runLink } = await import('./cli/link.js');
    await runLink(openspecChangeName).catch(die);
  });

function die(err: unknown): void {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

program.parse();
