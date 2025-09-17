#!/usr/bin/env node

const { execSync } = require('child_process');
const { copyFile } = require('fs/promises');
const { createRequire } = require('module');
const { join, resolve } = require('path');

async function copyBuildFile() {
  const modPath = findZigarCompiler();
  const srcPath = join(modPath, '../../zig/build.zig');
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
    const patchExePath = findExecutable('patch');
    const dryRunCmd = `"${patchExePath}" -d "${stdPath}" -t -p0 -N --dry-run < "${patchPath}"`;
    const dryRunResult = execSync(dryRunCmd).toString();
    const patchCmd = `"${patchExePath}" -d ${JSON.stringify(stdPath)} -t -p0 < ${JSON.stringify(patchPath)}`;
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
  try {
    if (process.platform === 'win32') {
      return execSync(`where ${cmd}`).toString().trim();
    } else {
      return execSync(`whereis ${cmd}`).toString().replace(/^\w+:\s*/, '').trim();
    }
  } catch {
    throw new Error(`Executable not found: ${cmd}`);
  }
}

function printHelp() {
  const lines = [
    'Usage: npx zigar-loader [command]',
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

(async () => {
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
})();
