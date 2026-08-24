import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), '.config', 'lv', 'lv.db');

export const storage = new LibSQLStore({
  id: 'lv-storage',
  url: `file:${dbPath}`,
});

export const mastra = new Mastra({
  storage,
});
