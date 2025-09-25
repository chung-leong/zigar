import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { CACHE, MEMORY, RESTORE, ZIG } from '../../src/symbols.js';
import { defineProperties, defineValue, ObjectCache } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Member: retval', function() {
  if (process.env.TARGET === 'wasm') {
    describe('defineRestorer', function() {
      it('should restore WASM memory buffer that has become detached', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const dv = new DataView(memory.buffer, 1000, 8);
        dv[ZIG] = { address: 1000, len: 8 };
        const constructor = function() {};
        defineProperties(constructor, {
          [CACHE]: defineValue(new ObjectCache()),
        });
        const object = defineProperties(new constructor(), {
          [MEMORY]: defineValue(dv),
          [RESTORE]: env.defineRestorer(),
        });
        memory.grow(1);
        expect(() => dv.getUint8(0)).to.throw(TypeError);
        const newDV = object[RESTORE]();
        expect(object[MEMORY]).to.not.equal(dv);
        expect(object[MEMORY]).to.equal(newDV);
        expect(() => object[MEMORY].getUint8(0)).to.not.throw();
        expect(constructor[CACHE].find(object[MEMORY])).to.equal(object);
      })
      it('should add align to new buffer when previous buffer has one attached', function() {
        const env = new Env();

        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const dv = new DataView(memory.buffer, 1000, 8);
        dv[ZIG] = { address: 1000, len: 8, align: 4 };
        const constructor = function() {};
        defineProperties(constructor, {
          [CACHE]: defineValue(new ObjectCache()),
        });
        const object = defineProperties(new constructor(), {
          [MEMORY]: defineValue(dv),
          [RESTORE]: env.defineRestorer(),
        });
        memory.grow(1);
        expect(() => dv.getUint8(0)).to.throw(TypeError);
        const newDV = object[RESTORE]();
        expect(object[MEMORY]).to.not.equal(dv);
        expect(object[MEMORY]).to.equal(newDV);
        expect(() => object[MEMORY].getUint8(0)).to.not.throw();
        expect(object[MEMORY][ZIG].align).to.equal(4);
      })
    })
  }
})

