import { expect } from 'chai';

import {
  load,
} from '../dist/index.js';

describe('Module loading', function() {
  it('should load module', async function() {
    const { pathname } = new URL('./samples/linux/libintegers.so', import.meta.url);
    const module = await load(pathname);
  })
  it('should throw when module is missing', async function() {
    const { pathname } = new URL('./samples/linux/missing.so', import.meta.url);
    let error;
    try {
      await load(pathname);
    } catch (err) {
      error = err;
    }
    expect(error).to.be.an('error');
  })
});
