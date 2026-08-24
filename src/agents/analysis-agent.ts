import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import path from 'path';
import os from 'os';
import { featureDocsTool } from '../tools/feature-docs.js';
import { recentChangesTool } from '../tools/recent-changes.js';
import { docReaderTool } from '../tools/doc-reader.js';
import { ANALYSIS_AGENT_INSTRUCTIONS } from '../prompts.js';

const dbPath = path.join(os.homedir(), '.config', 'lv', 'lv.db');

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'lv-analysis-memory',
    url: `file:${dbPath}`,
  }),
  options: {
    lastMessages: 20,
  },
});

export const analysisAgent = new Agent({
  id: 'lv-analysis-agent',
  name: 'LV Analysis Agent',
  description: 'Generates and updates requirement analysis documents for software tickets',
  model: 'openai/gpt-4o',  // overridden at generate() time via config.models.analysis
  memory,
  instructions: ANALYSIS_AGENT_INSTRUCTIONS,
  tools: {
    readFeatureDocs: featureDocsTool,
    getRecentDocChanges: recentChangesTool,
    readDocFile: docReaderTool,
  },
});

