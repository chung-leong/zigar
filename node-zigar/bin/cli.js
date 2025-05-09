#!/usr/bin/env node

import { copyFile, writeFile } from 'fs/promises';
import { createRequire } from 'module';
import { buildAddon } from 'node-zigar-addon';
import os from 'os';
import { dirname, join, parse, resolve } from 'path';
import { compile, findConfigFile, loadConfigFile, optionsForCompile } from 'zigar-compiler';
import { hideStatus, showResult, showStatus } from '../dist/status.cjs';

const possiblePlatforms = [
  'aix', 'darwin', 'freebsd', 'linux', 'linux-musl', 'openbsd', 'sunos', 'win32'
];
const possibleArchs = [
  'arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x',
  'x64'
];

async function buildModules() {
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
        console.warn(`Unrecognized archecture: ${arch}`);
      }
    }
    if (!possiblePlatforms.includes(platform)) {
      if (typeof(platform) !== 'string') {
        throw new Error(`Invalid value for platform: ${platform}`);
      } else {
        console.warn(`Unrecognized platform: ${platform}`);
      }
    }
  }
  const parentDirs = [];
  const currentIndex = config.targets.findIndex(({ platform, arch }) => platform === os.platform() && arch === os.arch());
  if (currentIndex !== -1) {
    const [ current ] = config.targets.splice(currentIndex, 1);
    config.targets.push(current);
  }
  for (const [ modPath, srcPath ] of Object.entries(config.sourceFiles)) {
    const modName = parse(modPath).name;
    for (const { platform, arch } of config.targets) {
      const { changed } = await compile(srcPath, modPath, {
        ...config,
        platform,
        arch,
        onStart: () => showStatus(`Building module "${modName}" (${platform}/${arch})`),
        onEnd: () => hideStatus(),
        configPath,
      });
      const action = (changed) ? 'Built' : 'Found';
      showResult(`${action} module "${modName}" (${platform}/${arch})`);
    }
    const parentDir = dirname(modPath);
    if (!parentDirs.includes(parentDir)) {
      parentDirs.push(parentDir);
    }
  }
  for (const parentDir of parentDirs) {
    const addonDir = join(parentDir, 'node-zigar-addon');
    for (const { platform, arch } of config.targets) {
      const { changed } = await buildAddon(addonDir, {
        platform,
        arch,
        onStart: () => showStatus(`Building Node.js addon (${platform}/${arch})`),
        onEnd: () => hideStatus(),
      });
      const action = (changed) ? 'Built' : 'Found';
      showResult(`${action} Node.js addon (${platform}/${arch})`);
    }
  }
}

async function createConfig() {
  const path = join(process.cwd(), 'node-zigar.config.json');
  const config = {
    optimize: 'ReleaseSmall',
    sourceFiles: {},
    targets: [
      {
        platform: os.platform(),
        arch: os.arch(),
      }
    ],
  };
  const json = JSON.stringify(config, undefined, 2);
  await writeFile(path, json);
}

async function copyBuildFile() {
  const require = createRequire(import.meta.url);
  const modPath = require.resolve('zigar-compiler');
  const srcPath = resolve(modPath, '../../zig/build.zig');
  const dstPath = join(process.cwd(), 'build.zig');
  await copyFile(srcPath, dstPath);
}

function printHelp() {
  const lines = [
    'Usage: npx node-zigar [command]',
    '',
    'Commands:',
    '',
    '  init          Create basic config file',
    '  build         Build library files for Zig modules and Node.js addon',
    '  custom        Create a copy of Zigar\'s build.zig in the current folder',
    '',
    '  help          Show this message',
    '',
  ];
  for (const line of lines) {
    console.log(line);
  }
}

try {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'init':
      await createConfig();
      break;
    case 'build':
      await buildModules();
      break;
    case 'custom':
      await copyBuildFile();
      break;
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      throw new Error(`Unrecognized command: ${cmd}`);
  }
} catch (err) {
  console.log(err.message);
  process.exit(1);
}
