import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const featureDocsTool = createTool({
  id: 'readFeatureDocs',
  description: 'Read all documentation files in a feature directory',
  inputSchema: z.object({
    featureDir: z.string().describe('Absolute path to the feature directory'),
  }),
  execute: async ({ featureDir }) => {

    if (!fs.existsSync(featureDir)) {
      return { content: '', files: [] };
    }

    const files = fs.readdirSync(featureDir).filter((f) => f.endsWith('.md'));
    if (files.length === 0) {
      return { content: '', files: [] };
    }

    const parts = files.map((file) => {
      const filePath = path.join(featureDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      return `## ${file}\n\n${content}`;
    });

    return {
      content: parts.join('\n\n---\n\n'),
      files,
    };
  },
});
