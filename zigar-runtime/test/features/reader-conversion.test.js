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
    it('should convert ReadableStream to a reader', async function() {
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
      const reader = env.convertReader(stream);
      let called = false;
      reader.onClose = () => called = true;
      const res1 = await reader.read(4);
      expect(res1).to.eql(new Uint8Array([ 1, 2, 3, 4 ]));
      const res2 = await reader.read(4);
      expect(res2).to.eql(new Uint8Array([ 5, 6, 7, 8 ]));
      const res3 = await reader.read(4);
      expect(res3).to.eql(new Uint8Array([ 9 ]));
      await delay(0);
      stream.close();
      expect(called).to.be.true;
    })
    it('should convert ReadableStreamDefaultReader to a reader', async function() {
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
    it('should convert ReadableStreamBYOBReader to a reader', async function() {
      const env = new Env();
      const stream = new ReadableStream({
        count: 0,

        async pull(controller) {
          const { byobRequest } = controller;
          if (this.count++ === 0) {
            const { view } = byobRequest;
            for (let i = 0; i < 9; i++) {
              view[i] = i + 1;
            }
            byobRequest.respond(9);
          } else {
            controller.close();
            byobRequest.respond(0);
          }
        },
        type: 'bytes',
      });
      const streamReader = stream.getReader({ mode: 'byob' })
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
      reader.seek(3, 0);
      const res4 = reader.read(4);
      expect(res4).to.eql(new Uint8Array([ 4, 5, 6, 7 ]));
      const res5 = reader.tell();
      expect(res5).to.equal(7);
      reader.seek(-2, 1);
      const res6 = reader.tell();
      expect(res6).to.equal(5);
      reader.seek(-1, 2);
      const res7 = reader.tell();
      expect(res7).to.equal(8);
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
      reader.seek(3, 0);
      const res4 = await reader.read(4);
      expect(res4).to.eql(new Uint8Array([ 4, 5, 6, 7 ]));
      const res5 = reader.tell();
      expect(res5).to.equal(7);
      blob.close();
    })
    it('should convert a string to a reader', async function() {
      const env = new Env();
      const string = Object('Hello world');
      const reader = env.convertReader(string);
      const res1 = await reader.read(4);
      expect(res1).to.eql(new Uint8Array([ 72, 101, 108, 108 ]));
      const res2 = await reader.read(4);
      expect(res2).to.eql(new Uint8Array([ 111, 32, 119, 111 ]));
      const res3 = await reader.read(4);
      expect(res3).to.eql(new Uint8Array([ 114, 108, 100 ]));
      reader.seek(3, 0);
      const res4 = await reader.read(4);
      expect(res4).to.eql(new Uint8Array([ 108, 111, 32, 119 ]));
      const res5 = reader.tell();
      expect(res5).to.equal(7);
      string.close();
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
    it('should return undefined when argument cannot be converted to a reader', async function() {
      const env = new Env();
      const result1 = env.convertReader({});
      expect(result1).to.be.undefined;
      const result2 = env.convertReader(undefined);
      expect(result2).to.be.undefined;
      const result3 = env.convertReader(null);
      expect(result3).to.be.an('object');
    })
  })
})
