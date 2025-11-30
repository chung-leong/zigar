import { expect } from 'chai';
import { PosixPollEventType } from '../src/constants.js';
import { WouldBlock } from '../src/errors.js';
import {
  ArrayWriter,
  BlobReader,
  MapDirectory,
  NullStream,
  StringReader,
  Uint8ArrayReadWriter,
  WebStreamReader,
  WebStreamReaderBYOB,
  WebStreamWriter,
} from '../src/streams.js';
import { delay } from './test-utils.js';

describe('Streams', function() {
  describe('WebStreamReader', function() {
    it('should attach close function to source reader', function() {
      const rs = new ReadableStream({
        async pull(controller) {
          controller.close();
        },
      });
      const reader = rs.getReader();
      const stream = new WebStreamReader(reader);
      expect(reader.close).to.be.a('function');
      let closed = false;
      stream.onClose = () => closed = true;
      reader.close();
      expect(closed).to.be.true;
      expect(reader.close).to.be.undefined;
    })
    it('should invoke all close functions when the same reader is used for multiple streams', function() {
      const rs = new ReadableStream({
        async pull(controller) {
          controller.close();
        },
      });
      const reader = rs.getReader();
      const stream1 = new WebStreamReader(reader);
      const stream2 = new WebStreamReader(reader);
      let closed1 = false, closed2 = false;
      stream1.onClose = () => closed1 = true;
      stream2.onClose = () => closed2 = true;
      reader.close();
      expect(closed1).to.be.true;
      expect(closed2).to.be.true;
    })
    describe('read', function() {      
      it('should read bytes from the next avialable chunk', async function() {
        const list = [ 
          new Uint8Array(16),
          new Uint8Array(32),
        ]
        const rs = new ReadableStream({
          async pull(controller) {
            const chunk = list.shift();
            if (chunk) {
              controller.enqueue(chunk);
            } else {
              controller.close();
            }
          },
        });
        const reader = rs.getReader();
        const stream = new WebStreamReader(reader);
        const chunk1 = await stream.read(4);
        expect(chunk1).to.be.an('Uint8Array');
        expect(chunk1).to.have.lengthOf(4);
        const chunk2 = await stream.read(16);
        expect(chunk2).to.have.lengthOf(12);
        const chunk3 = await stream.read(64);
        expect(chunk3).to.have.lengthOf(32);
        const chunk4 = await stream.read(64);
        expect(chunk4).to.have.lengthOf(0);
      })
      it('should convert other data views to Uint8Array', async function() {
        const list = [ 
          new Uint16Array(16),
          new DataView(new ArrayBuffer(32)),
          new ArrayBuffer(32),
          'Hello world',
        ];
        const rs = new ReadableStream({
          async pull(controller) {
            const chunk = list.shift();
            if (chunk) {
              controller.enqueue(chunk);
            } else {
              controller.close();
            }
          },
        });
        const reader = rs.getReader();
        const stream = new WebStreamReader(reader);
        const chunk1 = await stream.read(32);
        expect(chunk1).to.be.an('Uint8Array');
        expect(chunk1).to.have.lengthOf(32);
        const chunk2 = await stream.read(32);
        expect(chunk2).to.be.an('Uint8Array');
        expect(chunk2).to.have.lengthOf(32);
        const chunk3 = await stream.read(32);
        expect(chunk3).to.be.an('Uint8Array');
        expect(chunk3).to.have.lengthOf(32);
        const chunk4 = await stream.read(32);
        expect(chunk4).to.be.an('Uint8Array');
        expect(chunk4).to.have.lengthOf(11);
      })
    })
    describe('readnb', function() {      
      it('should throw WouldBlock when no data is available', async function() {
        const list = [ 
          new Uint8Array(16),
          new Uint8Array(32),
        ]
        const rs = new ReadableStream({
          async pull(controller) {
            const chunk = list.shift();
            if (chunk) {
              controller.enqueue(chunk);
            } else {
              controller.close();
            }
          },
        });
        const reader = rs.getReader();
        const stream = new WebStreamReader(reader);
        expect(() => stream.readnb(4)).throw(WouldBlock);
        await delay(10);
        const chunk1 = stream.readnb(4);
        expect(chunk1).to.have.lengthOf(4);
        const chunk2 = stream.readnb(32);
        expect(chunk2).to.have.lengthOf(12);
        expect(() => stream.readnb(4)).throw(WouldBlock);
      })
    })
    describe('destroy', function() {
      it('should cancel outstanding read operation', async function() {
        const rs = new ReadableStream({
          async pull(controller) {
            await delay(10);
            controller.enqueue(new Uint8Array(16));
          },
        });
        const reader = rs.getReader();
        const stream = new WebStreamReader(reader);
        const promise = stream.read(100);
        stream.destroy();
        const result = await promise;
        expect(result).to.have.lengthOf(0);
      })
    })
    describe('valueOf', function() {      
      it('should return source writer', function() {
        const rs = new ReadableStream({
          read() {}
        });
        const reader = rs.getReader();
        const stream = new WebStreamReader(reader);
        expect(stream.valueOf()).to.equal(reader);
      })
    })
  })
  describe('WebStreamReaderBYOB', function() {
    describe('read', function() {      
      it('should read bytes from the next avialable chunk', async function() {
        let count = 0;
        const rs = new ReadableStream({
          async pull(controller) {
            const { byobRequest } = controller;
            if (count++ < 2) {
              const { view } = byobRequest;
              for (let i = 0; i < 16; i++) {
                view[i] = 123;
              }
              byobRequest.respond(16);
            } else {
              controller.close();
              byobRequest.respond(0);
            }
          },
          type: 'bytes',
        });
        const reader = rs.getReader({ mode: 'byob' });
        const stream = new WebStreamReaderBYOB(reader);
        const chunk1 = await stream.read(32);
        expect(chunk1).to.be.an('Uint8Array');
        expect(chunk1).to.have.lengthOf(16);
        const chunk2 = await stream.read(32);
        expect(chunk2).to.have.lengthOf(16);
        const chunk3 = await stream.read(32);
        expect(chunk3).to.have.lengthOf(0);
      })
    })
  })
  describe('WebStreamWriter', function() {
    it('should trigger onClose listener when source writer is closed', async function() {
      const ws = new WritableStream({
        write(chunk, controller) {
          array.push(chunk);
        }
      });
      const writer = ws.getWriter();
      const stream = new WebStreamWriter(writer);
      let closed = false;
      stream.onClose = () => closed = true;
      writer.close();
      await delay(10);
      expect(closed).to.be.true;
    })
    describe('write', function() {
      it('should send chunk to writer', async function() {
        const array = [];
        const ws = new WritableStream({
          write(chunk, controller) {
            array.push(chunk);
          }
        });
        const writer = ws.getWriter();
        const stream = new WebStreamWriter(writer);
        const chunk = new TextEncoder().encode('Hello world');        
        const result = stream.write(chunk);
        expect(result).to.be.a('promise');
        await result;
        expect(array).to.have.lengthOf(1);
        expect(array[0]).to.be.an('Uint8Array');
        expect(array[0]).to.equal(chunk);
      })
    })
    describe('writenb', function() {
      it('should throw WouldBlock when previous writer has not finish', async function() {
        const array = [];
        const ws = new WritableStream({
          write(chunk, controller) {
            array.push(chunk);
          }
        });
        const writer = ws.getWriter();
        const stream = new WebStreamWriter(writer);
        const chunk = new TextEncoder().encode('Hello world');        
        const result = stream.writenb(chunk);
        expect(result).to.not.be.a('promise');
        expect(() => stream.writenb(chunk)).to.throw(WouldBlock);
        await delay(10);
        stream.writenb(chunk);
        await delay(10);
        expect(array).to.have.lengthOf(2);
      })
    })
    describe('destroy', function() {
      it('should close the sourece writer', async function() {
        const ws = new WritableStream({
          write(chunk, controller) {}
        });
        const writer = ws.getWriter();
        const stream = new WebStreamWriter(writer);
        let closed = false;
        stream.destroy();
        await writer.closed;
      })
    })
    describe('valueOf', function() {      
      it('should return source writer', function() {
        const ws = new WritableStream({
          write(chunk, controller) {}
        });
        const writer = ws.getWriter();
        const stream = new WebStreamWriter(writer);
        expect(stream.valueOf()).to.equal(writer);
      })
    })
  })
  describe('BlobReader', function() {
    it('should have a size property', function() {
      const blob = new Blob([ new Uint8Array(128) ]);
      const stream = new BlobReader(blob);
      expect(stream.size).to.equal(128);
    })
    it('should attach close function to source blob', function() {
      const blob = new Blob([ new Uint8Array(128) ]);
      const stream = new BlobReader(blob);
      expect(blob.close).to.be.a('function');
      let called = false;
      stream.onClose = () => called = true;
      blob.close();
      expect(called).to.be.true;
    })
    describe('read', function() {
      it('should read a chunk from the source blob', async function() {
        const blob = new Blob([ new Uint8Array(128) ]);
        const stream = new BlobReader(blob);
        const chunk = await stream.read(32);
        expect(chunk).to.have.lengthOf(32);       
      })
    })
    describe('readnb', function() {
      it('should throw WouldBlock when there is no data buffered', async function() {
        const blob = new Blob([ new Uint8Array(128) ]);
        const stream = new BlobReader(blob);
        expect(() => stream.readnb(32)).throw(WouldBlock);
        await delay(10);
        const chunk = stream.readnb(32);
        expect(chunk).to.have.lengthOf(32);
      })
    })
    describe('pread', function() {
      it('should read a chunk from the source blob at the specified offset', async function() {
        const array = new Uint8Array(128);
        array.set(new TextEncoder().encode('Hello world'), 100);
        const blob = new Blob([ array ]);
        const stream = new BlobReader(blob);
        const chunk = await stream.pread(32, 100);
        expect(chunk).to.have.lengthOf(28);
        expect(chunk[0]).to.equal('H'.charCodeAt(0));
      })
    })
    describe('seek', function() {
      it('should seek to specified offset', async function() {
        const array = new Uint8Array(128);
        array.set(new TextEncoder().encode('Hello world'), 100);
        const blob = new Blob([ array ]);
        const stream = new BlobReader(blob);
        stream.seek(-28, 2);
        const chunk = await stream.read(32);
        expect(chunk).to.have.lengthOf(28);
        expect(chunk[0]).to.equal('H'.charCodeAt(0));
      })
    })
    describe('tell', function() {
      it('should return current position', async function() {
        const blob = new Blob([ new Uint8Array(128) ]);
        const stream = new BlobReader(blob);
        const chunk = await stream.read(32);
        const pos = stream.tell();
        expect(pos).to.equal(32);
      })
    })
    describe('poll', function() {
      it('should return the number of bytes from the current position', async function() {
        const blob = new Blob([ new Uint8Array(128) ]);
        const stream = new BlobReader(blob);
        const chunk = await stream.read(28);
        expect(chunk).to.have.lengthOf(28);
        const amount = stream.poll();
        expect(amount).to.equal(100);
        const remaining = await stream.read(100);
        expect(remaining).to.have.lengthOf(100);
        const amountAfter = await stream.poll();
        expect(amountAfter).to.equal(0);
      })
    })
    describe('valueOf', function() {
      it('should return source blob', function() {
        const blob = new Blob([ new Uint8Array(128) ]);
        const stream = new BlobReader(blob);
        expect(stream.valueOf()).to.equal(blob);
      })
    })
  })
  describe('Uint8ArrayReadWriter', function() {
    it('should have a size property', function() {
      const array = new Uint8Array(128);
      const stream = new Uint8ArrayReadWriter(array)
      expect(stream.size).to.equal(128);
    })
    it('should attach close function to source array', function() {
      const array = new Uint8Array(128);
      const stream = new Uint8ArrayReadWriter(array)
      expect(array.close).to.be.a('function');
      let called = false;
      stream.onClose = () => called = true;
      array.close();
      expect(called).to.be.true;
    })
    describe('read', function() {
      it('should read a chunk from the source array', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = stream.read(32);
        expect(chunk).to.have.lengthOf(32);
      })
    })
    describe('readnb', function() {
      it('should read a chunk from the source array', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = stream.readnb(32);
        expect(chunk).to.have.lengthOf(32);
      })
    })
    describe('pread', function() {
      it('should read a chunk from the source array close to the end', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = stream.pread(32, 120);
        expect(chunk).to.have.lengthOf(8);
      })
    })
    describe('write', function() {
      it('should write to the source array', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = new TextEncoder().encode('Hello world');
        stream.write(chunk);
        expect(array[0]).to.equal('H'.charCodeAt(0));
        expect(array[10]).to.equal('d'.charCodeAt(0));
      })
    })
    describe('writenb', function() {
      it('should write to the source array', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = new TextEncoder().encode('Hello world');
        stream.writenb(chunk);
        expect(array[0]).to.equal('H'.charCodeAt(0));
        expect(array[10]).to.equal('d'.charCodeAt(0));
      })
    })
    describe('pwrite', function() {
      it('should write to the source array at specified offset', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = new TextEncoder().encode('Hello world');
        stream.pwrite(chunk, 100);
        expect(array[100]).to.equal('H'.charCodeAt(0));
        expect(array[110]).to.equal('d'.charCodeAt(0));
      })
    })
    describe('seek', function() {
      it('should seek to specified offset', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = new TextEncoder().encode('Hello world');
        stream.seek(100, 0);
        stream.write(chunk);
        expect(array[100]).to.equal('H'.charCodeAt(0));
        expect(array[110]).to.equal('d'.charCodeAt(0));
        stream.seek(-21, 1);
        stream.write(chunk);
        expect(array[90]).to.equal('H'.charCodeAt(0));
        expect(array[100]).to.equal('d'.charCodeAt(0));
        stream.seek(-100, 2);
        stream.write(chunk);
        expect(array[28]).to.equal('H'.charCodeAt(0));
        expect(array[38]).to.equal('d'.charCodeAt(0));
      })
    })
    describe('tell', function() {
      it('should return current position', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = stream.read(32);
        const pos = stream.tell();
        expect(pos).to.equal(32);
      })
    })
    describe('poll', function() {
      it('should return the number of bytes from the current position', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        const chunk = stream.read(28);
        const amount = stream.poll();
        expect(amount).to.equal(100);
      })
    })
    describe('valueOf', function() {
      it('should return source array', function() {
        const array = new Uint8Array(128);
        const stream = new Uint8ArrayReadWriter(array)
        expect(stream.valueOf()).to.equal(array);
      })
    })
  })
  describe('StringReader', function() {
    it('should create a reader for a string', function() {
      const text = 'Hello world';
      const stream = new StringReader(text);
      expect(stream.size).to.equal(text.length);
      expect(stream.valueOf()).to.equal(text);
    })
  })
  describe('ArrayWriter', function() {
    it('should attach close function to source array', function() {
      const array = [];
      const stream = new ArrayWriter(array);
      expect(array.close).to.be.a('function');
      let called = false;
      stream.onClose = () => called = true;
      array.close();
      expect(called).to.be.true;
    })
    describe('write', function() {
      it('should add chunk to array', function() {
        const array = [];
        const stream = new ArrayWriter(array);
        const chunk = new TextEncoder().encode('Hello world');
        stream.write(chunk);
        expect(array).to.have.lengthOf(1);
      })
    })
    describe('writenb', function() {
      it('should add chunk to array', function() {
        const array = [];
        const stream = new ArrayWriter(array);
        const chunk = new TextEncoder().encode('Hello world');
        stream.writenb(chunk);
        expect(array).to.have.lengthOf(1);
      })
    });
    describe('poll', function() {
      it('should return some large number', function() {
        const array = [];
        const stream = new ArrayWriter(array);
        const result = stream.poll(PosixPollEventType.FD_WRITE);
        expect(result).to.be.at.least(1024);
      })
    })
    describe('valueOf', function() {
      it('should return source array', function() {
        const array = [];
        const stream = new ArrayWriter(array);
        expect(stream.valueOf()).to.equal(array);
      })
    })
  })
  describe('NullStream', function() {
    describe('read', function() {
      it('should read nothing', function() {
        const stream = new NullStream();
        const chunk = stream.read(1024);
        expect(chunk).to.be.an('Uint8Array');
        expect(chunk).to.have.lengthOf(0);
      })
    })
    describe('pread', function() {
      it('should read nothing', function() {
        const stream = new NullStream();
        const chunk = stream.pread(1024, 10240n);
        expect(chunk).to.be.an('Uint8Array');
        expect(chunk).to.have.lengthOf(0);
      })
    })
    describe('write', function() {
      it('should do nothing', function() {
        const stream = new NullStream();
        const chunk = new Uint8Array(1024);
        stream.write(stream);
      })
    })
    describe('pwrite', function() {
      it('should do nothing', function() {
        const stream = new NullStream();
        const chunk = new Uint8Array(1024);
        stream.pwrite(stream, 10240n);
      })
    })
    describe('poll', function() {
      it('should return when polled for reading', function() {
        const stream = new NullStream();
        const result = stream.poll(PosixPollEventType.FD_READ);
        expect(result).to.equal(0);
      })
      it('should return some large number when polled for writing', function() {
        const stream = new NullStream();
        const result = stream.poll(PosixPollEventType.FD_WRITE);
        expect(result).to.be.at.least(1024);
      })
    })
    describe('valueOf', function() {
      it('should return null', function() {
        const stream = new NullStream();
        expect(stream.valueOf()).to.be.null;
      })
    })
  })
  describe('MapDirectory', function() {
    it('should attach close function to source map', function() {
      const map = new Map([
        [ 'hello.txt', new Uint8Array(16) ],
        [ 'world.txt', new Uint8Array(16) ],
      ]);
      const stream = new MapDirectory(map);
      expect(map.close).to.be.a('function');
      let closed = false;
      stream.onClose = () => closed = true;
      map.close();
      expect(closed).to.be.true;
    })
    describe('readdir', function() {
      it('should obtain directory entries', function() {
        const map = new Map([
          [ 'hello.txt', { type: 'file' } ],
          [ 'world.txt', { type: 'file' } ],
        ]);
        const stream = new MapDirectory(map);
        const entry1 = stream.readdir();
        expect(entry1).to.eql({ name: '.', type: 'directory' });
        const entry2 = stream.readdir();
        expect(entry2).to.eql({ name: '..', type: 'directory' });
        const entry3 = stream.readdir();
        expect(entry3).to.eql({ name: 'hello.txt', type: 'file' });
        const entry4 = stream.readdir();
        expect(entry4).to.eql({ name: 'world.txt', type: 'file' });
        const entry5 = stream.readdir();
        expect(entry5).to.be.null;
      })
    })
    describe('seek', function() {
      it('should seek to specified offset', function() {
        const map = new Map([
          [ 'hello.txt', { type: 'file' } ],
          [ 'world.txt', { type: 'file' } ],
        ]);
        const stream = new MapDirectory(map);
        stream.seek(1);
        const entry = stream.readdir();
        expect(entry).to.eql({ name: '..', type: 'directory' });
      })
    })
    describe('seek', function() {
      it('should seek to specified offset', function() {
        const map = new Map([
          [ 'hello.txt', { type: 'file' } ],
          [ 'world.txt', { type: 'file' } ],
        ]);
        const stream = new MapDirectory(map);
        const entry = stream.readdir();
        expect(entry).to.eql({ name: '.', type: 'directory' });
        const offset = stream.tell();
        expect(offset).to.equal(1);
      })
    })
    describe('valueOf', function() {
      it('should return source map', function() {
        const map = new Map([
          [ 'hello.txt', { type: 'file' } ],
          [ 'world.txt', { type: 'file' } ],
        ]);
        const stream = new MapDirectory(map);
        const result = stream.valueOf();
        expect(result).to.equal(map);
      })
    })
  })
})
