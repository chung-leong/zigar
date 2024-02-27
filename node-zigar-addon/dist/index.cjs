const { resolve } = require('path');
const os = require('os');

const extPath = resolve(`${__dirname}/../build/${os.platform()}/${os.arch()}/node-zigar-addon`);

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
