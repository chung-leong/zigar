#!/usr/bin/env bun

import { readFile, writeFile } from 'fs/promises';
import { buildAddon } from 'node-zigar-addon';
import os from 'os';
import { dirname, join, parse } from 'path';
import { compile, findConfigFile, optionsForCompile } from 'zigar-compiler';
import { loadConfigFile } from '../dist/config.js';
import { hideStatus, showResult, showStatus } from '../dist/status.js';

const possiblePlatforms = [
  'aix', 'darwin', 'freebsd', 'linux', 'linux-musl', 'openbsd', 'sunos', 'win32'
];
const possibleArchs = [
  'arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x',
  'x64'
];

async function buildModules() {
  // load node-zigar.config.js
  const configPath = await findConfigFile('bun-zigar.toml', process.cwd());
  if (!configPath) {
    throw new Error('Unable to find bun-zigar.toml');
  }
  const config = await loadConfigFile(configPath, optionsForCompile);
  if (!Array.isArray(config.targets)) {
    throw new Error('Unable to find array "targets" in bun-zigar.toml');
  }
  if (!config.sourceFiles) {
    throw new Error('Unable to find "sourceFiles" in bun-zigar.toml');
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
        onStart: () => showStatus(`Building Bun.js addon (${platform}/${arch})`),
        onEnd: () => hideStatus(),
      });
      const action = (changed) ? 'Built' : 'Found';
      showResult(`${action} Bun.js addon (${platform}/${arch})`);
    }
  }
}

async function createConfig() {
  const path = join(process.cwd(), 'bun-zigar.toml');
  const platform = os.platform();
  const arch = os.arch();
  const toml = `
optimize = "ReleaseSmall"

[sourceFiles]

[[targets]]
arch = "${arch}"
platform = "${platform}"
  `.trim() + '\n';
  await writeFile(path, toml);
}

async function addPreload() {
  const packagePath = await findConfigFile('package.json', process.cwd());
  if (!packagePath) {
    throw new Error(`Unable to find package.json`);
  }
  const bunfigPath = join(dirname(packagePath), 'bunfig.toml');
  let bunfigTOML = '';
  let bunfig;
  try {
    bunfigTOML = await readFile(bunfigPath, 'utf-8');
    if (bunfigTOML.trim()) {
      bunfig = await import(bunfigPath);
    }
  } catch (err) {
  }
  if (!bunfig || !Array.isArray(bunfig.preload) || !bunfig.preload.includes('bun-zigar')) {
    let m;
    if (m = /(preload\s*=\s*\[.*?)(\])/.exec(bunfigTOML)) {
      bunfigTOML = bunfigTOML.substring(0, m.index) + m[1] + ', "bun-zigar"' + m[2];
    } else {
      bunfigTOML = bunfigTOML.trim() ? bunfigTOML.trimEnd() + `

` : '';
      bunfigTOML = bunfigTOML + `preload = ["bun-zigar"]
`;
    }
    await writeFile(bunfigPath, bunfigTOML);
  }
}

function printHelp() {
  const lines = [
    'Usage: bunx bun-zigar [command]',
    '',
    'Commands:',
    '',
    '  init          Create basic config file',
    '  preload       Add bun-zigar as preloaded module to bunfig.toml',
    '  build         Build library files for Zig modules and Bun.js addon',
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
    case 'build':
      await buildModules();
      break;
    case 'preload':
      await addPreload();
      break;
    case 'init':
      await createConfig();
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

