import { expect } from 'chai';

import {
  defineEnvironment,
  mixin,
  name,
  reset
} from '../../src/environment/class.js';

describe('Environment class', function() {
  afterEach(function() {
    reset();
  })
  describe('defineEnvironment', function() {
    it('should set name of constructor', function() {
      name('Hello');
      const Env = defineEnvironment();
      expect(Env).to.have.property('name', 'Hello');
    })
    it('should attach methods from mixins', function() {
      name('HelloWorld');
      const log = [];
      mixin({
        hello() {
          log.push('hello');
        }
      })
      mixin({
        world() {
          log.push('world');
        }
      })
      const Env = defineEnvironment();
      expect(Env).to.have.property('name', 'HelloWorld');
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([ 'hello', 'world' ]);
    })
    it('should attach properties to instance', function() {
      const log = [];
      mixin({
        value1: 'hello',
        hello() {
          log.push(this.value1);
        }
      })
      mixin({
        value2: 'world',
        world() {
          log.push(this.value2);
        }
      })
      const Env = defineEnvironment();
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([ 'hello', 'world' ]);
    })
    it('should merge conflicted properties when they are objects', function() {
      const log = [];
      mixin({
        value: { prop1: 'hello' },
        hello() {
          log.push(this.value);
        }
      })
      mixin({
        value: { prop2: 'world' },
        world() {
          log.push(this.value);
        }
      })
      const Env = defineEnvironment();
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([
        { prop1: 'hello', prop2: 'world' },
        { prop1: 'hello', prop2: 'world' }
      ]);
    })
    it('should throw when conflicted properties cannot be merged', function() {
      mixin({
        value: 1234,
        hello() {
          log.push(this.value);
        }
      })
      mixin({
        value: 456,
        world() {
          log.push(this.value);
        }
      })
      expect(defineEnvironment).to.throw();
    })
    it('should not throw when conflicted properties have the same value', function() {
      mixin({
        value: 1234,
        hello() {
          log.push(this.value);
        }
      })
      mixin({
        value: 1234,
        world() {
          log.push(this.value);
        }
      })
      expect(defineEnvironment).to.not.throw();
    })
  })
})
