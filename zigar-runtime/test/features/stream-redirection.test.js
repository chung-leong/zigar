import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';
import { capture, delay } from '../test-utils.js';

import StreamRedirection from '../../src/features/stream-redirection.js';

const Env = defineClass('FeatureTest', [ StreamRedirection ]);

describe('Feature: stream-redirection', function() {
  describe('writeToConsole', function() {
    const encoder = new TextEncoder();
    it('should output text to console', async function() {
      const env = new Env();
      const lines = await capture(() => {
        const array = encoder.encode('Hello world\n');
        env.writeToConsole(new DataView(array.buffer));
      });
      expect(lines).to.eql([ 'Hello world' ]);
    })
    it('should allow addition text to be append to current line', async function() {
      const env = new Env();
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hello world');
        env.writeToConsole(new DataView(array1.buffer));
        await delay(10);
        const array2 = encoder.encode('!\n');
        env.writeToConsole(new DataView(array2.buffer));
      });
      expect(lines).to.eql([ 'Hello world!' ]);
      env.flushConsole();
    })
    it('should eventually output text not ending with newline', async function() {
      const env = new Env();
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hi!\nHello world');
        env.writeToConsole(new DataView(array1.buffer));
        await delay(10);
        const array2 = encoder.encode('!');
        env.writeToConsole(new DataView(array2.buffer));
        await delay(300);
      });
      expect(lines).to.eql([ 'Hi!', 'Hello world!' ]);
    })
  })
  describe('flushConsole', function() {
    const encoder = new TextEncoder();
    it('should force pending text to immediately get sent to console', async function() {
      const env = new Env();
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hello world');
        env.writeToConsole(array1);
        await delay(10);
        const array2 = encoder.encode('!');
        env.writeToConsole(array2);
        env.flushConsole();
      });
      expect(lines).to.eql([ 'Hello world!' ]);
    })
  })
})

