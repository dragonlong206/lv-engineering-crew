import { Agent } from '@mastra/core/agent';
import { listFilesTool, readFileTool, searchCodeTool } from '../tools/codebase.js';
import { BOOTSTRAP_AGENT_INSTRUCTIONS } from '../prompts.js';

export const bootstrapScanAgent = new Agent({
  id: 'lv-bootstrap-scan-agent',
  name: 'LV Bootstrap Scan Agent',
  description: 'Explores the codebase to finalize a feature\'s overview and design docs',
  model: 'openai/gpt-4o-mini', // overridden at generate() time via config.models.bootstrap
  instructions: BOOTSTRAP_AGENT_INSTRUCTIONS,
  tools: {
    listFiles: listFilesTool,
    readFile: readFileTool,
    searchCode: searchCodeTool,
  },
});
