#!/usr/bin/env node

const { copyFile } = require('fs/promises');
const { join, resolve } = require('path');

async function copyBuildFile() {
  const modPath = require.resolve('zigar-compiler');
  const srcPath = resolve(modPath, '../../zig/build.zig');
  const dstPath = join(process.cwd(), 'build.zig');
  await copyFile(srcPath, dstPath);
}

function printHelp() {
  const lines = [
    'Usage: npx zigar-loader [command]',
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

(async () => {
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
})();
