import { createRequire } from 'module';
import { fileURLToPath } from 'url';

let gcStatisticsRetriever;

export function createEnvironment() {
  const require = createRequire(import.meta.url);
  const extPath = fileURLToPath(new URL('../build/Release/node-zigar-addon', import.meta.url));
  const { createEnvironment, getGCStatistics } = require(extPath);
  gcStatisticsRetriever = getGCStatistics;
  return createEnvironment();
}

export function importModule(libPath, options = {}) {
  const env = createEnvironment();
  env.loadModule(libPath);
  env.acquireStructures(options);
  return env.useStructures();
}

export function getGCStatistics() {
  return gcStatisticsRetriever?.();
}