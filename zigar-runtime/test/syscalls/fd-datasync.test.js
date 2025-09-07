import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: fd-datasync', function() {
  it('should do nothing when stream does not support feature', async function() {
    const env = new Env();
    const encoder = new TextEncoder();
    const array = encoder.encode('Hello world');
    env.redirectStream(0, array);
    const result = env.fdDatasync(0);
    expect(result).to.equal(PosixError.NONE);
  })
  it('should call handler when stream has support', async function() {
    const env = new Env();
    let called;
    const stream = {
      read() {},
      datasync() {
        called = true;
      },
    }
    env.redirectStream(0, stream);
    const result = env.fdDatasync(0);
    expect(result).to.equal(PosixError.NONE);
    expect(called).to.be.true;
  })
  it('should return an error code when handle is invalid', async function() {
    const env = new Env();
    const result = env.fdDatasync(4);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      const f = env.getWASIHandler('fd_datasync');
      let called;
      const stream = {
        read() {},
        datasync() {
          called = true;
        },
      }
      env.redirectStream(0, stream);
      const result = f(0);
      expect(result).to.equal(PosixError.NONE);
      expect(called).to.be.true;
    })

  }
})
