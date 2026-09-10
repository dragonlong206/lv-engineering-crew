import { Mastra } from '@mastra/core';
import type { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, MastraStorageExporter } from '@mastra/observability';
import { getLvDbPath, isTracingEnabled, loadConfig } from '../config.js';

const dbPath = getLvDbPath();

export const storage = new LibSQLStore({
  id: 'lv-storage',
  url: `file:${dbPath}`,
});

const config = loadConfig();

export const mastra = new Mastra({
  storage,
  observability: isTracingEnabled(config)
    ? new Observability({
        configs: {
          default: {
            serviceName: 'lv',
            exporters: [new MastraStorageExporter()],
          },
        },
      })
    : undefined,
});

/**
 * Registers an agent with the shared `mastra` instance so its runs participate in its
 * observability, returning the same instance for immediate use. Falls back to the
 * already-registered agent under `agent.id` if called again with that id in this process
 * (`addAgent` throws on a duplicate key), so a factory that builds a fresh `Agent` per call
 * stays safe to call more than once within one process.
 */
export function registerAgent<T extends Agent>(agent: T): T {
  try {
    mastra.addAgent(agent);
    return agent;
  } catch {
    return mastra.getAgentById(agent.id) as T;
  }
}
