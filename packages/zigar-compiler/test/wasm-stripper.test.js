import { expect } from 'chai';
import { readFile, writeFile } from 'fs/promises';

import {
  SectionType,
  parseBinary,
  repackBinary,
  parseFunction,
  repackFunction,
  stripUnused,
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
  ].map(name => resolve(`./wasm-samples/${name}.wasm`));
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
      this.timeout(10000);
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
  describe('parseFunction', function() {
    it('should parse a function body in the code section', async function() {
      const path = resolve(`./wasm-samples/fail.wasm`);
      const content = await readFile(path);
      const binary = new DataView(content.buffer);
      const module = parseBinary(binary);
      const codeSection = module.sections.find(s => s.type === SectionType.Code);
      expect(codeSection).to.not.be.undefined;
      const { functions: [ fn ] } = codeSection;
      expect(fn).be.an.instanceOf(DataView);
      const { locals, instructions } = parseFunction(fn);
      expect(locals).to.be.an('array').with.lengthOf(0);
      expect(instructions).to.be.an('array').with.lengthOf(4);
      const [ instr1, instr2, instr3, instr4 ] = instructions;
      expect(instr1).to.eql({ opcode: 65, operand: 1 });  // load i32
      expect(instr2).to.eql({ opcode: 65, operand: 0 });  // load i32
      expect(instr3).to.eql({ opcode: 109, operand: undefined });  // div
      expect(instr4).to.eql({ opcode: 11, operand: undefined });  // end
    })
  })
  describe('repackFunction', function() {
    it('should recreate function body', async function() {
      const path = resolve(`./wasm-samples/fail.wasm`);
      const content = await readFile(path);
      const binary = new DataView(content.buffer);
      const module = parseBinary(binary);
      const codeSection = module.sections.find(s => s.type === SectionType.Code);
      expect(codeSection).to.not.be.undefined;
      const { functions: [ fn ] } = codeSection;
      expect(fn).be.an.instanceOf(DataView);
      const result = parseFunction(fn);
      const newFn = repackFunction(result);
      expect(newFn).to.be.an.instanceOf(DataView);
      expect(newFn.byteLength).to.equal(fn.byteLength);
      for (let i = 0; i < newFn.byteLength; i++) {
        expect(newFn.getUint8(i)).to.equal(fn.getUint8(i));
      }
    })
    it('should handle more complicated file', async function() {
      this.timeout(10000);
      const path = resolve(`./wasm-samples/exporter.wasm`);
      const content = await readFile(path);
      const binary = new DataView(content.buffer);
      const module = parseBinary(binary);
      const codeSection = module.sections.find(s => s.type === SectionType.Code);
      expect(codeSection).to.not.be.undefined;
      const { functions } = codeSection;
      for (const [ index, fn ] of functions.entries()) {
        expect(fn).be.an.instanceOf(DataView);
        const result = parseFunction(fn);
        const newFn = repackFunction(result);
        expect(newFn).to.be.an.instanceOf(DataView);
        expect(newFn.byteLength).to.equal(fn.byteLength);
        for (let i = 0; i < newFn.byteLength; i++) {
          expect(newFn.getUint8(i)).to.equal(fn.getUint8(i));
        }
      }
    })
  })
  describe('stripUnused', function() {
    it('should remove unused functions', async function() {
      const path = resolve(`./wasm-samples/exporter.wasm`);
      const content = await readFile(path);
      const binary = new DataView(content.buffer);
      const newBinary = stripUnused(binary);
      expect(newBinary.byteLength).to.be.below(binary.byteLength);
    })
  })
})

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
