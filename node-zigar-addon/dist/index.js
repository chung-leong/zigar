import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const extPath = fileURLToPath(new URL('../build/Release/node-zigar-addon', import.meta.url));

export function createEnvironment() {
  const { createEnvironment } = require(extPath);
  return createEnvironment();
}

export function importModule(libPath, options = {}) {
  const env = createEnvironment();
  env.loadModule(libPath);
  env.acquireStructures(options);
  return env.useStructures();
}

export function getGCStatistics() {
  const { getGCStatistics } = require(extPath);
  return getGCStatistics();
}
