import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import { InvalidArgument } from '../../src/errors.js';
import '../../src/mixins-wasi.js';
import { delay } from '../test-utils.js';

use(ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: reader-conversion', function() {
  describe('convertReader', function() {
    it('should convert ReadStreamDefaultReader to a reader', async function() {
      const env = new Env();
      const stream = new ReadableStream({
        count: 0,

        async pull(controller) {
          if (this.count++ === 0) {
            controller.enqueue(new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]));
          } else {
            controller.close();
          }
        }
      });
      const streamReader = stream.getReader()
      const reader = env.convertReader(streamReader);
      let called = false;
      reader.onClose = () => called = true;
      const buffer = new Uint8Array(4);
      const res1 = await reader.read(buffer);
      expect(res1).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = await reader.read(buffer);
      expect(res2).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = await reader.read(buffer);
      expect(res3).to.equal(1);
      expect(buffer).to.eql(new Uint8Array([ 9, 6, 7, 8 ]));
      await delay(0);
      expect(called).to.be.true;
      reader.close();
    })
    it('should convert an Uint8Array to a reader', async function() {
      const env = new Env();
      const array = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      const reader = env.convertReader(array);
      const buffer = new Uint8Array(4);
      const res1 = reader.read(buffer);
      expect(res1).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = reader.read(buffer);
      expect(res2).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = reader.read(buffer);
      expect(res3).to.equal(1);
      expect(buffer).to.eql(new Uint8Array([ 9, 6, 7, 8 ]));
      reader.seek(3n, 0);
      const res4 = reader.read(buffer);
      expect(res4).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 4, 5, 6, 7 ]));
      const res5 = reader.tell();
      expect(res5).to.equal(7n);
      reader.seek(-2n, 1);
      const res6 = reader.tell();
      expect(res6).to.equal(5n);
      reader.seek(-1n, 2);
      const res7 = reader.tell();
      expect(res7).to.equal(8n);
      expect(() => reader.seek(1000, 0)).to.throw(InvalidArgument);
      let called = false;
      reader.onClose = () => called = true;
      reader.close();
      expect(called).to.be.true;
    })
    it('should convert a Blob to a reader', async function() {
      const env = new Env();
      const blob = new Blob([
        new Uint8Array([ 1, 2, 3, 4, 5 ]),
        new Uint8Array([ 6, 7, 8, 9 ]),
      ]);
      const reader = env.convertReader(blob);
      const buffer = new Uint8Array(4);
      const res1 = await reader.read(buffer);
      expect(res1).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = await reader.read(buffer);
      expect(res2).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = await reader.read(buffer);
      expect(res3).to.equal(1);
      expect(buffer).to.eql(new Uint8Array([ 9, 6, 7, 8 ]));
      reader.seek(3n, 0);
      const res4 = await reader.read(buffer);
      expect(res4).to.equal(4);
      expect(buffer).to.eql(new Uint8Array([ 4, 5, 6, 7 ]));
      const res5 = reader.tell();
      expect(res5).to.equal(7n);
      reader.close();
    })
    it('should convert null to a reader', async function() {
      const env = new Env();
      const reader = env.convertReader(null);
      const buffer = new Uint8Array(4);
      const res = await reader.read(buffer);
      expect(res).to.equal(0);
      expect(buffer).to.eql(new Uint8Array([ 0, 0, 0, 0 ]));
      let called = false;
      reader.onClose = () => called = true;
      reader.close();
      expect(called).to.be.true;
    })
    it('should return the same object when it contains a read function', async function() {
      const env = new Env();
      const originalReader = {
        read() {},
      };
      const reader = env.convertReader(originalReader);
      expect(reader).to.equal(originalReader);
    })
    it('should throw when argument cannot be converted to a reader', async function() {
      const env = new Env();
      expect(() => env.convertReader({})).to.throw(Error)
        .with.property('message').that.contains('ReadableStreamDefaultReader');
      expect(() => env.convertReader(undefined)).to.throw(Error)
        .with.property('message').that.contains('undefined');
      expect(() => env.convertReader(null)).to.not.throw();
    })
  })
})
