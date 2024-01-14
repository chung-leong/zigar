import { createRequire } from 'module';
import { fileURLToPath } from 'url';

let gcStatisticsRetriever;

export function loadModule(libPath) {
  const require = createRequire(import.meta.url);
  const extPath = fileURLToPath(new URL('../build/Release/node-zigar-addon', import.meta.url));
  const { loadModule, getGCStatistics } = require(extPath);
  gcStatisticsRetriever = getGCStatistics;
  return loadModule(libPath);
}

export async function importModule(libPath, options = {}) {
  const env = await loadModule(libPath);
  env.acquireStructures(options);
  return env.useStructures();
}

export async function exportStructures(libPath, options = {}) {
  const env = await loadModule(libPath);
  env.acquireStructures(options);
  const definition = env.exportStructures();
  env.abandon();
  return definition;
}

export function getGCStatistics() {
  return gcStatisticsRetriever?.();
}