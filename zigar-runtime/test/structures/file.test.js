import { expect } from 'chai';
import { open } from 'fs/promises';
import 'mocha-skip-if';
import { fileURLToPath } from 'url';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Structure: file', function() {
  describe('createFile', function() {
    it('should create a file struct from an instanceof ReadableStreamDefaultReader', async function() {
      const env = new Env();
      let count = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          if (count++ < 4) {
            controller.enqueue(new Uint8Array(8));
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      const file = env.createFile(reader);
      expect(file.handle).to.be.a('number');
    })
    it('should create a file struct from a Blob', async function() {
      const env = new Env();
      const blob = new Blob([
        new Uint8Array([ 0, 1, 2, 3 ]),
        new Uint8Array([ 4, 5, 6, 7, 8 ]),
      ])
      const file = env.createFile(blob);
      expect(file.handle).to.be.a('number');
      expect(blob.close).to.be.a('function');
    })
    it('should create a file struct from an array', async function() {
      const env = new Env();
      const array = [];
      const file = env.createFile(array);
      expect(file.handle).to.be.a('number');
      expect(array.close).to.be.a('function');
    })
    it('should return the same object if it has a handle property', async function() {
      const env = new Env();
      const object = { handle: 1234 };
      const file = env.createFile(object);
      expect(file).to.equal(object);
    })
    it('should throw error when argument cannot be converted', async function() {
      const env = new Env();
      expect(() => env.createFile(1234)).to.throw(Error);
    })
    if (process.env.TARGET === 'node') {
      it('should copy handle from Node FileHandle object', async function() {
        const env = new Env();
        const path = fileURLToPath(import.meta.url);
        const handle = await open(path);
        try {
          const file = env.createFile(handle);
          expect(file.handle).to.equal(handle.fd);
        } finally {
          handle.close();
        }
      })
    }
  })
})
