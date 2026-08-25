import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { getLvDbPath } from './config.js';

const dbPath = getLvDbPath();

export const storage = new LibSQLStore({
  id: 'lv-storage',
  url: `file:${dbPath}`,
});

export const mastra = new Mastra({
  storage,
});
