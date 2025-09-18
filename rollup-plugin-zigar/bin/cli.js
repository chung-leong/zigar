#!/usr/bin/env node

import { execSync } from 'child_process';
import { copyFile } from 'fs/promises';
import { createRequire } from 'module';
import { join, resolve } from 'path';

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

async function patchStandardLibrary() {
  try {
    const modPath = findZigarCompiler();
    const patchPath = join(modPath, 'wasi-thread.patch');
    const zigPath = resolve(findExecutable('zig'), '..');
    const stdPath = join(zigPath, 'lib/std');
    const patchExePath = findExecutable('patchsa');
    const dryRunCmd = `patch -d "${stdPath}" -t -p0 -N --dry-run < "${patchPath}"`;
    const dryRunResult = execSync(dryRunCmd).toString();
    const patchCmd = `patch -d ${JSON.stringify(stdPath)} -t -p0 < ${JSON.stringify(patchPath)}`;
    const result = execSync(patchCmd).toString();
    console.log(result);
  } catch (err) {
    const dryRunError = err.stdout?.toString?.() ?? err.message;
    throw new Error(`Operation failed:\n\n${dryRunError}`);
  }
}

function findZigarCompiler() {
  const require = createRequire(import.meta.url);
  const jsPath = require.resolve('zigar-compiler');
  return resolve(jsPath, '../..');
}

function findExecutable(cmd) {
  let path;
  try {
    if (process.platform === 'win32') {
      path = execSync(`where ${cmd}`).toString().trim();
    } else {
      [ path ] = execSync(`whereis ${cmd}`).toString().replace(/^\w+:\s*/, '').trim().split(/\s+/);
    }
  } catch {}
  if (!path) {
    throw new Error(`Executable not found: ${cmd}`);
  }
  return path;
}

function printHelp() {
  const lines = [
    'Usage: npx rollup-plugin-zigar [command]',
    '',
    'Commands:',
    '',
    '  custom        Create a copy of Zigar\'s build.zig in the current folder',
    '  extra         Create a barebone build.extra.zig in the current folder',
    '  patch         Patch Zig\'s standard library to enable thread support',
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
    case 'custom':
      await copyBuildFile();
      break;
    case 'extra':
      await copyBuildExtraFile();
      break;
    case 'patch':
      await patchStandardLibrary();
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
