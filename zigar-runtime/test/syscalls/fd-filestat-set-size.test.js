import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-filestat-set-size', function() {
  it('should return an error code when stream does not support feature', async function() {
    const env = new Env();
    const encoder = new TextEncoder();
    const array = encoder.encode('Hello world');
    env.redirectStream('stdin', array);
    let result; 
    const [ error ] = await captureError(() => {
      result = env.fdFilestatSetSize(0, 123n);
    });
    expect(result).to.equal(PosixError.EINVAL);
  })
  it('should call handler when stream has support', async function() {
    const env = new Env();
    let args;
    const stream = {
      read() {},
      truncate(...a) {
        args = a;
      },
    }
    env.redirectStream('stdin', stream);
    const result = env.fdFilestatSetSize(0, 123n);
    expect(result).to.equal(PosixError.NONE);
    expect(args).to.eql([ 123 ]);
  })
  it('should return an error code when handle is invalid', async function() {
    const env = new Env();
    const result = env.fdFilestatSetSize(4, 123n)
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_filestat_set_size');
      let args;
      const stream = {
        read() {},
        truncate(...a) {
          args = a;
        },
      }
      env.redirectStream('stdin', stream);
      const result = f(0, 123n);
      expect(result).to.equal(PosixError.NONE);
      expect(args).to.eql([ 123 ]);
    })
  }
})
