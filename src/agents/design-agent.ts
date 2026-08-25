import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { featureDocsTool } from '../tools/feature-docs.js';
import { recentChangesTool } from '../tools/recent-changes.js';
import { docReaderTool } from '../tools/doc-reader.js';
import { DESIGN_AGENT_INSTRUCTIONS } from '../prompts.js';
import { getLvDbPath } from '../config.js';

const dbPath = getLvDbPath();

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'lv-design-memory',
    url: `file:${dbPath}`,
  }),
  options: {
    lastMessages: 20,
  },
});

export const designAgent = new Agent({
  id: 'lv-design-agent',
  name: 'LV Design Agent',
  description: 'Generates and updates technical design documents based on approved analysis',
  model: 'openai/gpt-4o',  // overridden at generate() time via config.models.design
  memory,
  instructions: DESIGN_AGENT_INSTRUCTIONS,
  tools: {
    readFeatureDocs: featureDocsTool,
    getRecentDocChanges: recentChangesTool,
    readDocFile: docReaderTool,
  },
});

