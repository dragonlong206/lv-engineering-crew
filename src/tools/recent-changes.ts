import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getRecentLog } from '../integrations/git/client.js';

export const recentChangesTool = createTool({
  id: 'getRecentDocChanges',
  description: 'Get recent git commits and diffs for a feature directory (last 30 days)',
  inputSchema: z.object({
    repoRoot: z.string().describe('Absolute path to the git repository root'),
    featureDir: z.string().describe('Absolute path to the feature directory'),
  }),
  execute: async ({ repoRoot, featureDir }) => {
    const log = await getRecentLog(repoRoot, featureDir, 30);
    return { log: log || 'No recent changes in the last 30 days.' };
  },
});
