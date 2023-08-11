import { endianness } from 'os';
import { addTests } from '../../zigar-compiler/test/integration.js';

describe('Integration tests (node-zigar)', function() {
  addTests(importModule, { littleEndian: endianness() === 'LE' });
})

async function importModule(path) {
  const optimize = process.env.ZIGAR_OPTIMIZE;
  return import(`${path}?optimize=${optimize}`);
}