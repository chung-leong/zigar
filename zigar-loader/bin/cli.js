#!/usr/bin/env node

const { execSync } = require('child_process');
const { copyFile } = require('fs/promises');
const { join, resolve } = require('path');
const { test } = require('zigar-compiler/cjs');

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

async function runTests(args) {
  let srcPath, extraArgs = [];
  for (const arg of args) {
    if (!srcPath && !arg.startsWith('-')) {
      srcPath = resolve(process.cwd(), arg);
    } else {
      extraArgs.push(arg);
    }
  }  
  const { code } = await test(srcPath, { extraArgs });
  if (code) {
    process.exit(code);
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
    '  test <path>   Run a Zig module\'s unit tests',
    '',
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
      case 'test':
        await runTests(process.argv.slice(3));
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
