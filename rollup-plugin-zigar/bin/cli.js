#!/usr/bin/env node

import { copyFile } from 'fs/promises';
import { createRequire } from 'module';
import { join, resolve } from 'path';

async function copyBuildFile() {
  const require = createRequire(import.meta.url);
  const modPath = require.resolve('zigar-compiler');
  const srcPath = resolve(modPath, '../../zig/build.zig');
  const dstPath = join(process.cwd(), 'build.zig');
  await copyFile(srcPath, dstPath);
}

function printHelp() {
  const lines = [
    'Usage: npx rollup-plugin-zigar [command]',
    '',
    'Commands:',
    '',
    '  custom        Create a copy of Zigar\'s build.zig in the current folder',
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
