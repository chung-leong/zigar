import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import 'mocha-skip-if';

import {
  parseBinary,
  repackBinary,
} from '../src/wasm-stripper.js';

const littleEndian = true;

describe('WASM stripper', function() {
  const wasmFiles = [
    'fail',
    'global',
    'memory',
    'simple',
    'table',
    'table2',
  ].map(name => resolve(`./wasm-files/${name}.wasm`));
  describe('parseBinary', function() {
    it('should parse WASM files', async function() {
      for (const path of wasmFiles) {
        const content = await readFile(path);
        const binary = new DataView(content.buffer);
        const module = parseBinary(binary);
        expect(module.sections).to.be.an('array');
      }
    })
  })
  describe('repackBinary', function() {
    it('should recreate WASM binary', async function() {
      for (const path of wasmFiles) {
        const content = await readFile(path);
        const binary = new DataView(content.buffer);
        const module = parseBinary(binary);
        const newBinary = repackBinary(module);
        expect(newBinary.byteLength).to.equal(binary.byteLength);
        for (let i = 0; i < newBinary.byteLength; i++) {
          expect(newBinary.getUint8(i)).to.equal(binary.getUint8(i));
        }
      }
    })
  })
})

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
