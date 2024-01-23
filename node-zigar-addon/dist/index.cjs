const { fileURLToPath } = require('url');

const extPath = fileURLToPath(new URL('../build/Release/node-zigar-addon', import.meta.url));

function createEnvironment() {
  const { createEnvironment } = require(extPath);
  return createEnvironment();
}

function importModule(libPath, options = {}) {
  const env = createEnvironment();
  env.loadModule(libPath);
  env.acquireStructures(options);
  return env.useStructures();
}

function getGCStatistics() {
  const { getGCStatistics } = require(extPath);
  return getGCStatistics();
}

module.exports = {
  createEnvironment,
  importModule,
  getGCStatistics,
};
