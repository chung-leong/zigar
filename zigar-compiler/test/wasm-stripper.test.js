import { expect } from 'chai';
import { readFile, readdir } from 'fs/promises';

import {
  SectionType,
  parseBinary,
  repackBinary,
  parseFunction,
  repackFunction,
  stripUnused,
  parseNames,
  MagicNumber,
  repackNames,
} from '../src/wasm-stripper.js';

const littleEndian = true;

describe('WASM stripper', function() {
  describe('parseBinary', function() {
    it('should parse WASM files', async function() {
      const wasmFiles = [
        'fail',
        'global',
        'memory',
        'simple',
        'table',
        'table2',
      ].map(name => resolve(`./wasm-samples/basic/${name}.wasm`));
      for (const path of wasmFiles) {
        const content = await readFile(path);
        const binary = new DataView(content.buffer);
        const module = parseBinary(binary);
        expect(module.sections).to.be.an('array');
      }
    })
    it('should throw when the magic number is incorrect', async function() {
      const binary = new DataView(new ArrayBuffer(8));
      expect(() => parseBinary(binary)).to.throw();
    })
    it('should throw when the version number is incorrect', async function() {
      const binary = new DataView(new ArrayBuffer(8));
      binary.setUint32(0, MagicNumber, true);
      expect(() => parseBinary(binary)).to.throw();
    })
  })
  describe('repackBinary', function() {
    it('should recreate WASM binary', async function() {
      this.timeout(10000);
      const wasmFiles = [
        'fail',
        'global',
        'memory',
        'simple',
        'table',
        'table2',
      ].map(name => resolve(`./wasm-samples/basic/${name}.wasm`));
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
    it('should recreate WASM files from WABT test suite', async function() {
      this.timeout(10000);
      const dir = resolve(`./wasm-samples/wabt-test-suite`);
      const names = await readdir(dir);
      const wasmFiles = names.filter(n => /\.wasm$/.test(n)).map(n => `${dir}/${n}`);
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
      const path = resolve(`./wasm-samples/basic/fail.wasm`);
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
      const path = resolve(`./wasm-samples/basic/fail.wasm`);
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
      const path = resolve(`./wasm-samples/basic/exporter.wasm`);
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
    it('should repack code from WABT test suite', async function() {
      this.timeout(60000);
      const dir = resolve(`./wasm-samples/wabt-test-suite`);
      const names = await readdir(dir);
      const wasmFiles = names.filter(n => /\.wasm$/.test(n)).map(n => `${dir}/${n}`);
      for (const path of wasmFiles) {
        const content = await readFile(path);
        const binary = new DataView(content.buffer);
        const module = parseBinary(binary);
        const codeSection = module.sections.find(s => s.type === SectionType.Code);
        if (codeSection) {
          const { functions } = codeSection;
          for (const [ index, fn ] of functions.entries()) {
            expect(fn).be.an.instanceOf(DataView);
            const result = parseFunction(fn);
            const newFn = repackFunction(result);
            expect(newFn.byteLength).to.equal(fn.byteLength);
            for (let i = 0; i < newFn.byteLength; i++) {
              expect(newFn.getUint8(i)).to.equal(fn.getUint8(i));
            }
          }
        }
      }
    })
  })
  describe('stripUnused', function() {
    it('should remove unused functions', async function() {
      const path = resolve(`./wasm-samples/basic/exporter.wasm`);
      const content = await readFile(path);
      const binary = new DataView(content.buffer);
      const newBinary = stripUnused(binary);
      expect(newBinary.byteLength).to.be.below(binary.byteLength);
    })
  })
  describe('parseNames', function() {
    it('should extract module name from name section', async function() {
      const path = resolve(`./wasm-samples/basic/module-name.wasm`);
      const content = await readFile(path);
      const binary = new DataView(content.buffer);
      const { sections } = parseBinary(binary);
      const nameSection = sections.find(s => s.name === 'name');
      const { moduleName } = parseNames(nameSection);
      expect(moduleName).to.equal('my_module');
    })
  })
  describe('repackNames', function() {
    it('should create data for name section', function() {
      const moduleName = 'Hello';
      const functionNames = [
        'func1',
        'func2',
        'func3',
      ];
      const localNames = [
        [
          { index: 0, name: 'var1' },
          { index: 1, name: 'var2' },
          { index: 2, name: 'var3' },
        ],
        [
          { index: 0, name: 'var1' },
          { index: 1, name: 'var2' },
          { index: 2, name: 'var3' },
        ],
        [
          { index: 0, name: 'var1' },
          { index: 1, name: 'var2' },
          { index: 2, name: 'var3' },
        ],
      ];
      const size = 1024;
      const data = repackNames({ moduleName, functionNames, localNames, size });
      const parsed = parseNames({ data });
      expect(parsed.moduleName).to.equal(moduleName);
      expect(parsed.functionNames).to.eql(functionNames);
      expect(parsed.localNames).to.eql(localNames);
    })
  })
})

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
