import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-advise', function() {
  it('should do nothing when stream does not support feature', async function() {
    const env = new Env();
    const encoder = new TextEncoder();
    const array = encoder.encode('Hello world');
    env.redirectStream(0, array);
    const result = env.fdAdvise(0, 123n, 16, 2);
    expect(result).to.equal(PosixError.NONE);
  })
  it('should call handler when stream has support', async function() {
    const env = new Env();
    let args;
    const stream = {
      read() {},
      advise(...a) {
        args = a;
      },
    }
    env.redirectStream(0, stream);
    const result = env.fdAdvise(0, 123n, 16, 2);
    expect(result).to.equal(PosixError.NONE);
    expect(args).to.eql([ 123n, 16, 'random' ]);
  })
  it('should return an error code when handle is invalid', async function() {
    const env = new Env();
    let result;
    const [ error ] = await captureError(() => { 
      result = env.fdAdvise(4, 123n, 16, 2);
    });
    expect(result).to.equal(PosixError.EBADF);
    expect(error).to.contains('file descriptor');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_advise');
      let args;
      const stream = {
        read() {},
        advise(...a) {
          args = a;
        },
      }
      env.redirectStream(0, stream);
      const result = f(0, 123n, 16, 2);
      expect(result).to.equal(PosixError.NONE);
      expect(args).to.eql([ 123n, 16, 'random' ]);
    })
  }
})
