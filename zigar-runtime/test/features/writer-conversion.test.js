import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { delay } from '../test-utils.js';

use(ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: writer-conversion', function() {
  describe('convertWriter', function() {
    it('should convert WritableStream to a writer', async function() {
      const env = new Env();
      const chunks = [];
      const stream = new WritableStream({
        async write(chunk) {
          chunks.push(chunk);
        }
      });
      const writer = env.convertWriter(stream);
      const bytes = new Uint8Array([ 0, 1, 2, 3 ]);
      await writer.write(bytes);
      expect(chunks).to.have.lengthOf(1);
      let called = false;
      writer.onClose = () => called = true;
      await stream.close();
      await delay(100);
      expect(called).to.be.true;
    })
    it('should convert WritableStreamDefaultWriter to a writer', async function() {
      const env = new Env();
      const chunks = [];
      const stream = new WritableStream({
        async write(chunk) {
          chunks.push(chunk);
        }
      });
      const streamWriter = stream.getWriter()
      const writer = env.convertWriter(streamWriter);
      const bytes = new Uint8Array([ 0, 1, 2, 3 ]);
      await writer.write(bytes);
      expect(chunks).to.have.lengthOf(1);
      let called = false;
      writer.onClose = () => called = true;
      streamWriter.close();
      await delay(0);
      expect(called).to.be.true;
    })
    it('should convert an array to a writer', async function() {
      const env = new Env();
      const chunks = [];
      const writer = env.convertWriter(chunks);
      const bytes = new Uint8Array([ 0, 1, 2, 3 ]);
      await writer.write(bytes);
      expect(chunks).to.have.lengthOf(1);
      let called = false;
      writer.onClose = () => called = true;
      chunks.close();
      await delay(0);
      expect(called).to.be.true;
    })
    it('should convert null to a writer', async function() {
      const env = new Env();
      const writer = env.convertWriter(null);
      const bytes = new Uint8Array([ 0, 1, 2, 3 ]);
      writer.write(bytes);
    })
    it('should return the same object when it contains a write function', async function() {
      const env = new Env();
      const originalWriter = {
        write() {},
      };
      const writer = env.convertWriter(originalWriter);
      expect(writer).to.equal(originalWriter);
    })
    it('should return undefined when argument cannot be converted to a writer', async function() {
      const env = new Env();
      const result1 = env.convertWriter({});
      expect(result1).to.undefined;
      const result2 = env.convertWriter(undefined);
      expect(result2).to.undefined;
      const result3 = env.convertWriter(null);
      expect(result3).to.an('object');
    })
  })
})
