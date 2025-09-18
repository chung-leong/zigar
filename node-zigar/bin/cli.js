#!/usr/bin/env node

import { copyFile, writeFile } from 'fs/promises';
import { createRequire } from 'module';
import { buildAddon, optionsForAddon } from 'node-zigar-addon';
import os from 'os';
import { dirname, extname, join, parse, relative, resolve } from 'path';
import {
  compile, findConfigFile, generateCode, getArch, getPlatform, loadConfigFile, optionsForCompile,
} from 'zigar-compiler';
import { hideStatus, showResult, showStatus } from '../dist/status.cjs';

const require = createRequire(import.meta.url);

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
  const availableOptions = { ...optionsForCompile, ...optionsForAddon };
  const config = await loadConfigFile(configPath, availableOptions);
  config.recompile = true;
  if (!Array.isArray(config.targets)) {
    throw new Error('Unable to find array "targets" in node-zigar.config.json');
  }
  if (!config.modules) {
    throw new Error('Unable to find "modules" in node-zigar.config.json');
  }
  const { optimizeAddon, ...compileOptions } = config;
  // make sure targets are valid
  for (const { arch, platform } of config.targets) {
    let msg;
    if (!possibleArchs.includes(arch)) {
      if (typeof(arch) !== 'string') {
        msg = `Invalid value for arch: ${arch}`;
      } else {
        msg = `Unrecognized archecture: ${arch}`;
        let possible;
        switch (arch) {
          case 'arm32': possible = 'arm'; break;
          case 'aarch64': possible = 'arm64'; break;
          case 'x86': possible = 'ia32'; break;
          case 'x86_64': possible = 'x64'; break;
          case 'powerpc64':
          case 'powerpc64le': possible = 'ppc64'; break;
        }
        if (possible) msg += ` (do you mean '${possible}'?)`;
      }
    }
    if (!possiblePlatforms.includes(platform)) {
      if (typeof(platform) !== 'string') {
        msg = `Invalid value for platform: ${platform}`;
      } else {
        msg = `Unrecognized platform: ${platform}`;
        let possible;
        switch (platform) {
          case 'windows': possible = 'win32'; break;
          case 'macosx': 
          case 'macos': possible = 'darwin'; break;
        }
        if (possible) msg += ` (do you mean '${possible}'?)`;
      }
    }
    if (msg) {
      throw new Error(msg);
    }
  }
  const parentDirs = [];
  const current = { platform: getPlatform(), arch: getArch() };
  const currentIndex = config.targets.findIndex(t => t.platform === current.platform && t.arch === current.arch);
  if (currentIndex !== -1) {
    const [ current ] = config.targets.splice(currentIndex, 1);
    config.targets.push(current);
  }
  const nativeModulePaths = {};
  for (const [ modPath, module ] of Object.entries(config.modules)) {
    const modName = parse(modPath).name;
    for (const { platform, arch } of config.targets) {
      const { outputPath, changed } = await compile(module.source, modPath, {
        ...compileOptions,
        platform,
        arch,
        onStart: () => showStatus(`Building module "${modName}" (${platform}/${arch})`),
        onEnd: () => hideStatus(),
        configPath,
      });
      const action = (changed) ? 'Built' : 'Found';
      showResult(`${action} module "${modName}" (${platform}/${arch})`);
      if (platform === current.platform && arch === current.arch) {
        nativeModulePaths[modPath] = outputPath;
      }
    }
    const parentDir = dirname(modPath);
    if (!parentDirs.includes(parentDir)) {
      parentDirs.push(parentDir);
    }
  }
  const nativeAddonPaths = {};
  for (const parentDir of parentDirs) {
    const addonDir = join(parentDir, 'node-zigar-addon');
    for (const { platform, arch } of config.targets) {
      const { outputPath, changed } = await buildAddon(addonDir, {
        recompileAddon: true,
        optimizeAddon,
        platform,
        arch,
        onStart: () => showStatus(`Building Node.js addon (${platform}/${arch})`),
        onEnd: () => hideStatus(),
      });
      const action = (changed) ? 'Built' : 'Found';
      showResult(`${action} Node.js addon (${platform}/${arch})`);
      if (platform === current.platform && arch === current.arch) {
        nativeAddonPaths[parentDir] = outputPath;
      }
    }
  }
  // generate standalone loaders
  for (const [ modPath, module ] of Object.entries(config.modules)) {
    if (!module.loader) continue;
    const parentDir = dirname(modPath);
    const addonPath = nativeAddonPaths[parentDir];
    const modulePath = nativeModulePaths[modPath];
    if (!addonPath || !modulePath) {
      throw new Error(`Unable to generate loader as there is no support for current platform: ${current.platform}/${current.arch}`);
    }
    const { createEnvironment } = require(addonPath);
    const env = createEnvironment();
    env.loadModule(modulePath);
    env.acquireStructures(config);
    const definition = env.exportStructures();
    const loaderDir = dirname(module.loader);
    const standaloneLoader = {
      addonDir: relative(loaderDir, dirname(addonPath)),
      moduleDir: relative(loaderDir, dirname(modulePath)),
      type: (extname(module.loader) === '.cjs') ? 'cjs' : 'esm',
    };
    const { code } = generateCode(definition, { standaloneLoader });
    await writeFile(module.loader, code);
  }
}

async function createConfig() {
  const path = join(process.cwd(), 'node-zigar.config.json');
  const config = {
    optimize: 'ReleaseSmall',
    modules: {
      "lib/???.zigar": {
        source: "zig/???.zig",
      }
    },
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
  const modPath = findZigarCompiler();
  const srcPath = join(modPath, 'zig/build.zig');
  const dstPath = join(process.cwd(), 'build.zig');
  await copyFile(srcPath, dstPath);
}

async function copyBuildExtraFile() {
  const modPath = findZigarCompiler();
  const srcPath = join(modPath, 'zig/build.extra.zig');
  const dstPath = join(process.cwd(), 'build.extra.zig');
  await copyFile(srcPath, dstPath);
}

function findZigarCompiler() {
  const require = createRequire(import.meta.url);
  const jsPath = require.resolve('zigar-compiler');
  return resolve(jsPath, '../..');
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
    '  extra         Create a barebone build.extra.zig in the current folder',
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
    case 'extra':
      await copyBuildExtraFile();
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
