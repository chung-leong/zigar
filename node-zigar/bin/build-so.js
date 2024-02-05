#!/usr/bin/env node

import {
  addPlatformExt, compile, findConfigFile, loadConfigFile, optionsForCompile
} from 'zigar-compiler';

const possiblePlatforms = [ 
  'aix', 'darwin', 'freebsd','linux', 'openbsd', 'sunos', 'win32'
];
const possibleArchs = [
  'arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x',
  'x64' 
];

try {
  // load node-zigar.config.js
  const configPath = await findConfigFile('node-zigar.config.json', process.cwd());
  if (!configPath) {
    throw new Error('Unable to find node-zigar.config.json');
  }
  const config = await loadConfigFile(configPath, optionsForCompile);
  if (!Array.isArray(config.targets)) {
    throw new Error('Unable to find array "targets" in node-zigar.config.json');
  }
  if (!config.sourceFiles) {
    throw new Error('Unable to find "sourceFiles" in node-zigar.config.json');
  }
  // make sure targets are valid
  for (const { arch, platform } of config.targets) {
    if (!possibleArchs.includes(arch)) {
      if (typeof(arch) !== 'string') {
        throw new Error(`Invalid value for arch: ${arch}`);
      } else {
        throw new Error(`Unsupported archecture: ${arch}`);
      }
    }
    if (!possiblePlatforms.includes(platform)) {
      if (typeof(platform) !== 'string') {
        throw new Error(`Invalid value for platform: ${platform}`);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    }
  }
  for (const [ soPathPI, srcPath ] of Object.entries(config.sourceFiles)) {
    for (const options of config.targets) {
      const soPath = addPlatformExt(soPathPI, options);
      console.log(`Building ${soPath}...`);
      await compile(srcPath, soPath, { ...config, ...options}); 
    }
  }
} catch (err) {
  console.log(err.message);
  process.exit(1);
}
