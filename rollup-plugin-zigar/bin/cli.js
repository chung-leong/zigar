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

async function patchStandardLibrary() {
  const modPath = findZigarCompiler();
  const patchPath = join(modPath, 'wasi-thread.patch');
  const zigPath = findZigCompiler();
  const stdPath = join(zigPath, 'lib/std');  
  const dryRunCmd = `patch -d "${stdPath}" -t -p0 -N --dry-run < "${patchPath}"`;
  try {
    const dryRunResult = execSync(dryRunCmd).toString();
    const patchCmd = `patch -d "${stdPath}" -t -p0 < "${patchPath}"`;
    const result = execSync(patchCmd).toString();
    console.log(result);
  } catch (err) {
    const dryRunError = err.stdout.toString();
    throw new Error(`Operation failed:\n\n${dryRunError}`);
  }
}

function findZigarCompiler() {
  const require = createRequire(import.meta.url);
  const jsPath = require.resolve('zigar-compiler');
  return resolve(jsPath, '../..');
}

function findZigCompiler() {
  let binPath;
  if (process.platform === 'win32') {
    const result = execSync(`where zig`).toString();
    binPath = result;
  } else {
    const result = execSync(`whereis zig`).toString();
    binPath = result.replace(/^\w+:\s*/, '');
  }
  return resolve(binPath, '..');
}

function printHelp() {
  const lines = [
    'Usage: npx rollup-plugin-zigar [command]',
    '',
    'Commands:',
    '',
    '  custom        Create a copy of Zigar\'s build.zig in the current folder',
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
