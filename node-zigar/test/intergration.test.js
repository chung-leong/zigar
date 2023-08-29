import { endianness } from 'os';
import { addTests } from '../../zigar-compiler/test/integration.js';
import 'mocha-skip-if';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (node-zigar, ${optimize})`, function() {
    addTests(importModule, {
      littleEndian: endianness() === 'LE',
      target: 'NODE-CPP-EXT',
      optimize,
    });
  })
}

async function importModule(path) {
  const optimize = process.env.ZIGAR_OPTIMIZE;
  return import(`${path}?optimize=${optimize}`);
}