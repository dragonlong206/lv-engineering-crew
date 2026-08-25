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
  .command('start <ticket-id>')
  .description('Start a new ticket: fetch from Lark, create branch, generate analysis doc')
  .option('--type <type>', 'Branch type to use (default from .lv.yaml default_branch_type)')
  .action(async (ticketId: string, opts: { type?: string }) => {
    const { runStart } = await import('./cli/start.js');
    await runStart(ticketId, opts).catch(die);
  });

program
  .command('answer')
  .description('Open current doc for editing, then update based on your changes')
  .action(async () => {
    const { runAnswer } = await import('./cli/answer.js');
    await runAnswer().catch(die);
  });

program
  .command('approve')
  .description('Approve current step and advance to the next')
  .action(async () => {
    const { runApprove } = await import('./cli/approve.js');
    await runApprove().catch(die);
  });

program
  .command('design')
  .description('Generate design document (requires analysis to be approved)')
  .action(async () => {
    const { runDesign } = await import('./cli/design.js');
    await runDesign().catch(die);
  });

program
  .command('bootstrap <feature-id>')
  .description('Generate feature docs from code — from --paths, or by scanning the repo autonomously')
  .option('--paths <paths>', 'Comma-separated paths to read code from (omit to scan the repo autonomously)')
  .option('--name <name>', 'Feature name hint for autonomous scan mode (no --paths)')
  .option('--description <description>', 'Feature description hint for autonomous scan mode (no --paths)')
  .action(async (featureId: string, opts: { paths?: string; name?: string; description?: string }) => {
    const { runBootstrap } = await import('./cli/bootstrap.js');
    await runBootstrap(featureId, opts.paths, { name: opts.name, description: opts.description }).catch(die);
  });

program
  .command('init <docs...>')
  .description('Analyze requirement documents (BRD/SRD/SSD/prototypes) and create feature folders')
  .option('--id-prefix <prefix>', 'Feature ID prefix (default from .lv.yaml)')
  .option('--id-digits <n>', 'Feature ID zero-padded digit count (default from .lv.yaml)')
  .action(async (docs: string[], opts: { idPrefix?: string; idDigits?: string }) => {
    const { runInit } = await import('./cli/init.js');
    await runInit(docs, opts).catch(die);
  });

program
  .command('resume [ticket-id]')
  .description('Resume a ticket: continue the workflow, or ask for approval if waiting on you')
  .action(async (ticketId?: string) => {
    const { runResume } = await import('./cli/resume.js');
    await runResume(ticketId).catch(die);
  });

program
  .command('status')
  .description('Show current ticket status')
  .action(async () => {
    const { runStatus } = await import('./cli/status.js');
    await runStatus().catch(die);
  });

function die(err: unknown): void {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}

program.parse();
