import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';

export const docReaderTool = createTool({
  id: 'readDocFile',
  description: 'Read a specific documentation file',
  inputSchema: z.object({
    filePath: z.string().describe('Absolute path to the file'),
  }),
  execute: async ({ filePath }) => {
    if (!fs.existsSync(filePath)) {
      return { content: '', exists: false };
    }
    return { content: fs.readFileSync(filePath, 'utf-8'), exists: true };
  },
});
