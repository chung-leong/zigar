import { endianness } from 'os';
import { addTests } from '../../zigar-compiler/test/integration.js';
import 'mocha-skip-if';

skip.if(process.env.npm_lifecycle_event === 'coverage').
describe('Integration tests (node-zigar)', function() {
  addTests(importModule, {
    littleEndian: endianness() === 'LE',
    target: 'NODE-CPP-EXT',
    optimize: 'Debug',
  });
})

async function importModule(path) {
  const optimize = process.env.ZIGAR_OPTIMIZE;
  return import(`${path}?optimize=${optimize}`);
}