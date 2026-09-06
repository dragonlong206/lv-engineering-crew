import { Agent } from '@mastra/core/agent';
import { buildCodebaseTools } from '../tools/codebase.js';
import { BOOTSTRAP_AGENT_INSTRUCTIONS, buildOutputLanguageParagraph } from '../prompts.js';

export function createBootstrapScanAgent(
  extensions?: string[],
  skipDirs?: string[],
  outputLanguage?: string,
): Agent {
  const { listFilesTool, readFileTool, searchCodeTool } = buildCodebaseTools(extensions, skipDirs);

  return new Agent({
    id: 'lv-bootstrap-scan-agent',
    name: 'LV Bootstrap Scan Agent',
    description: 'Explores the codebase to finalize a feature\'s overview and design docs',
    model: 'openai/gpt-4o-mini', // overridden at generate() time via config.models.bootstrap
    instructions: BOOTSTRAP_AGENT_INSTRUCTIONS + buildOutputLanguageParagraph(outputLanguage),
    tools: {
      listFiles: listFilesTool,
      readFile: readFileTool,
      searchCode: searchCodeTool,
    },
  });
}
