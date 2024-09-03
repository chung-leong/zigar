import { defineClass } from '../../src/environment.js';

import CallMarshalingOutbound from '../../src/features/call-marshaling-outbound.js';
import DataCopying from '../../src/features/data-copying.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import { ALIGN, COPY, MEMORY } from '../../src/symbols.js';
import { defineProperties, defineProperty } from '../../src/utils.js';

const Env = defineClass('FeatureTest', [ MemoryMapping, DataCopying, CallMarshalingOutbound ]);

describe('Feature: memory-mapping', function() {
  describe('', function() {
    describe('getShadowAddress', function() {
      it('should create a shadow of an object and return the its address', function() {
        const env = new Env();
        const Test = function(dv) {
          this[MEMORY] = dv;
        };
        defineProperty(Test.prototype, COPY, env.defineCopier(8))
        const object = new Test(new DataView(new ArrayBuffer(8)));
        env.allocateShadowMemory = function(len, align) {
          return new DataView(new ArrayBuffer(len));
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        const address = env.getShadowAddress(object);
        expect(address).to.equal(0x1000);
      })
      it('should return shadow addresses of objects in a cluster', function() {
        const env = new Env();
        const Test = function(dv) {
          this[MEMORY] = dv;
        };
        defineProperty(Test.prototype, COPY, env.defineCopier(8))
        Test[ALIGN] = 4;
        const buffer = new ArrayBuffer(16);
        const object1 = new Test(new DataView(buffer, 0, 8));
        const object2 = new Test(new DataView(buffer, 4, 8));
        const cluster = {
          targets: [ object1, object2 ],
          start: 0,
          end: 12,
          address: undefined,
        };
        env.allocateShadowMemory = function(len, align) {
          return new DataView(new ArrayBuffer(len));
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        const address1 = env.getShadowAddress(object1, cluster);
        const address2 = env.getShadowAddress(object2, cluster);
        expect(address1).to.equal(0x1000 + 4);
        expect(address2).to.equal(0x1004 + 4);
      })
    })
    describe('createShadow', function() {
      it('should create a shadow of an object', function() {
        const env = new Env();
        const Test = function(dv) {
          this[MEMORY] = dv;
        };
        defineProperty(Test.prototype, COPY, env.defineCopier(8))
        const object = new Test(new DataView(new ArrayBuffer(8)));
        env.allocateShadowMemory = function(len, align) {
          return new DataView(new ArrayBuffer(len));
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        const shadow = env.createShadow(object);
        expect(shadow).to.be.instanceOf(Test);
        expect(shadow[MEMORY].byteLength).to.equal(8);
      })
    })
    describe('createClusterShadow', function() {
      it('should create a shadow for a cluster of objects', function() {
        const env = new Env();
        env.allocateShadowMemory = function(len, align) {
          return new DataView(new ArrayBuffer(len));
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        const Test = function(dv) {
          this[MEMORY] = dv;
        };
        defineProperty(Test.prototype, COPY, env.defineCopier(8))
        Test[ALIGN] = 4;
        const buffer = new ArrayBuffer(32);
        const object1 = new Test(new DataView(buffer, 3, 8));
        const object2 = new Test(new DataView(buffer, 7, 8));
        const object3 = new Test(new DataView(buffer, 11, 8));
        const cluster = {
          targets: [ object1, object2, object3 ],
          start: 3,
          end: 19,
        };
        object1[MEMORY].setUint32(0, 1234, true);
        env.startContext();
        const shadow = env.createClusterShadow(cluster);
        expect(shadow[MEMORY].byteLength).to.equal(16);
        expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
        env.updateShadows();
        expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
      })
      it('should use alignment attached to data views', function() {
        const env = new Env();
        env.allocateShadowMemory = function(len, align) {
          return new DataView(new ArrayBuffer(len));
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        const Test = function(dv) {
          this[MEMORY] = dv;
          dv[ALIGN] = 4;
        };
        defineProperty(Test.prototype, COPY, env.defineCopier(8))
        Test[ALIGN] = undefined;
        const buffer = new ArrayBuffer(32);
        const object1 = new Test(new DataView(buffer, 3, 8));
        const object2 = new Test(new DataView(buffer, 7, 8));
        const object3 = new Test(new DataView(buffer, 11, 8));
        const cluster = {
          targets: [ object1, object2, object3 ],
          start: 3,
          end: 19,
        };
        object1[MEMORY].setUint32(0, 1234, true);
        env.startContext();
        const shadow = env.createClusterShadow(cluster);
        expect(shadow[MEMORY].byteLength).to.equal(16);
        expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
        env.updateShadows();
        expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
      })

      it('should throw when objects have incompatible alignments', function() {
        const env = new Env();
        env.allocateShadowMemory = function(len, align) {
          return new DataView(new ArrayBuffer(len));
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        const Test = function(dv) {
          this[MEMORY] = dv;
        };
        defineProperty(Test.prototype, COPY, env.defineCopier(8))
        Test[ALIGN] = 4;
        const buffer = new ArrayBuffer(32);
        const object1 = new Test(new DataView(buffer, 4, 8));
        const object2 = new Test(new DataView(buffer, 7, 8));
        const object3 = new Test(new DataView(buffer, 13, 8));
        const cluster = {
          targets: [ object1, object2, object3 ],
          start: 4,
          end: 21,
        };
        env.startContext();
        expect(() => env.createClusterShadow(cluster)).to.throw(TypeError);
      })
    })
    describe('addShadow', function() {
      it('should add a shadow', function() {
        const env = new Env();
        const object = {
          [MEMORY]: new DataView(new ArrayBuffer(4))
        };
        const shadow = {
          [MEMORY]: new DataView(new ArrayBuffer(4))
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        expect(env.context.shadowMap).to.be.null;
        env.addShadow(shadow, object);
        expect(env.context.shadowMap.size).to.equal(1);
      })
    })
    describe('removeShadow', function() {
      it('should remove a previously added shadow', function() {
        const env = new Env();
        const object = {
          [MEMORY]: new DataView(new ArrayBuffer(4))
        };
        const shadow = {
          [MEMORY]: new DataView(new ArrayBuffer(4))
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        env.addShadow(shadow, object);
        env.removeShadow(shadow[MEMORY]);
        expect(env.context.shadowMap.size).to.equal(0);
      })
    })
    describe('updateShadows', function() {
      it('should do nothing where there are no shadows', function() {
        const env = new Env();
        env.startContext();
        env.updateShadows();
      })
      it('should copy data from targets to shadows', function() {
        const env = new Env();
        const object = {
          [MEMORY]: new DataView(new ArrayBuffer(4)),
        };
        const shadow = {};
        defineProperties(shadow, {
          [MEMORY]: { value: new DataView(new ArrayBuffer(4)) },
          [COPY]: this.defineCopier(),
        });
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        env.addShadow(shadow, object);
        object[MEMORY].setUint32(0, 1234, true);
        env.updateShadows();
        expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
      })
    })
    describe('updateShadowTargets', function() {
      it('should do nothing where there are no shadows', function() {
        const env = new Env();
        env.startContext();
        env.updateShadowTargets();
      })
      it('should copy data from shadows to targets', function() {
        const env = new Env();
        const object = {};
        defineProperties(object, {
          [MEMORY]: { value: new DataView(new ArrayBuffer(4)) },
          [COPY]: env.defineCopier(8),
        });
        const shadow = {
          [MEMORY]: new DataView(new ArrayBuffer(4)),
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        env.startContext();
        env.addShadow(shadow, object);
        shadow[MEMORY].setUint32(0, 1234, true);
        env.updateShadowTargets();
        expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
      })
    })
    describe('releaseShadows', function() {
      it('should do nothing where there are no shadows', function() {
        const env = new Env();
        env.startContext();
        env.releaseShadows();
      })
      it('should free the memory of shadows', function() {
        const env = new Env();
        const object = {
          [MEMORY]: new DataView(new ArrayBuffer(4)),
        };
        const shadow = {
          [MEMORY]: new DataView(new ArrayBuffer(4)),
        };
        env.getBufferAddress = function() {
          return 0x1000;
        };
        let freed;
        env.freeShadowMemory = function(dv) {
          freed = dv;
        };
        env.startContext();
        env.addShadow(shadow, object);
        env.releaseShadows();
        expect(freed).to.equal(shadow[MEMORY]);
      })
    })
  })
})