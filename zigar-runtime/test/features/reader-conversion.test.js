import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import { InvalidArgument } from '../../src/errors.js';
import '../../src/mixins.js';
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
      const res1 = await reader.read(4);
      expect(res1).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = await reader.read(4);
      expect(res2).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = await reader.read(4);
      expect(res3).to.eql(new Uint8Array([ 9 ]));
      await delay(0);
      streamReader.close();
      expect(called).to.be.true;
    })
    it('should convert an Uint8Array to a reader', async function() {
      const env = new Env();
      const array = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      const reader = env.convertReader(array);
      const res1 = reader.read(4);
      expect(res1).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = reader.read(4);
      expect(res2).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = reader.read(4);
      expect(res3).to.eql(new Uint8Array([ 9 ]));
      reader.seek(3n, 0);
      const res4 = reader.read(4);
      expect(res4).to.eql(new Uint8Array([ 4, 5, 6, 7 ]));
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
      array.close();
      expect(called).to.be.true;
    })
    it('should convert a Blob to a reader', async function() {
      const env = new Env();
      const blob = new Blob([
        new Uint8Array([ 1, 2, 3, 4, 5 ]),
        new Uint8Array([ 6, 7, 8, 9 ]),
      ]);
      const reader = env.convertReader(blob);
      const res1 = await reader.read(4);
      expect(res1).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = await reader.read(4);
      expect(res2).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = await reader.read(4);
      expect(res3).to.eql(new Uint8Array([ 9 ]));
      reader.seek(3n, 0);
      const res4 = await reader.read(4);
      expect(res4).to.eql(new Uint8Array([ 4, 5, 6, 7 ]));
      const res5 = reader.tell();
      expect(res5).to.equal(7n);
      blob.close();
    })
    it('should convert null to a reader', async function() {
      const env = new Env();
      const reader = env.convertReader(null);
      const buffer = new Uint8Array(4);
      const res = await reader.read(buffer);
      expect(res).to.have.property('length', 0);
      expect(buffer).to.eql(new Uint8Array([ 0, 0, 0, 0 ]));
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
