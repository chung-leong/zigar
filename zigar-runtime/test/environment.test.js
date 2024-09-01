import { expect } from 'chai';

import {
  defineClass,
  defineEnvironment,
  mixin,
  name,
} from '../src/environment.js';

describe('Environment class', function() {
  describe('defineClass', function() {
    it('should set name of constructor', function() {
      const Env = defineClass('Hello', []);
      expect(Env).to.have.property('name', 'Hello');
    })
    it('should attach methods from mixins', function() {
      const log = [];
      const mixins = [
        {
          hello() {
            log.push('hello');
          }
        },
        {
          world() {
            log.push('world');
          }
        },
      ];
      const Env = defineClass('Hello', mixins);
      expect(Env).to.have.property('name', 'Hello');
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([ 'hello', 'world' ]);
    })
    it('should attach properties to instance', function() {
      const log = [];
      const mixins = [
        {
          value1: 'hello',
          hello() {
            log.push(this.value1);
          }
        },
        {
          value2: 'world',
          world() {
            log.push(this.value2);
          }
        },
      ];
      const Env = defineClass('Hello', mixins);
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([ 'hello', 'world' ]);
    })
    it('should merge conflicted properties when they are objects', function() {
      const log = [];
      const mixins = [
        {
          value: { prop1: 'hello' },
          hello() {
            log.push(this.value);
          }
        },
        {
          value: { prop2: 'world' },
          world() {
            log.push(this.value);
          }
        },
      ];
      const Env = defineClass('Hello', mixins);
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([
        { prop1: 'hello', prop2: 'world' },
        { prop1: 'hello', prop2: 'world' }
      ]);
    })
    it('should throw when conflicted properties cannot be merged', function() {
      const mixins = [
        {
          value: 1234,
          hello() {
            log.push(this.value);
          }
        },
        {
          value: 456,
          world() {
            log.push(this.value);
          }
        },
      ];
      expect(() => defineClass('Hello', mixins)).to.throw();
    })
    it('should not throw when conflicted properties have the same value', function() {
      const mixins = [
        {
          value: 1234,
          hello() {
            log.push(this.value);
          }
        },
        {
          value: 1234,
          world() {
            log.push(this.value);
          }
        },
      ];
      expect(() => defineClass('Hello', mixins)).to.not.throw();
    })
  })
  describe('defineEnvironment', function() {
    it('should define a class using collected info', function() {
      name('Hello');
      const log = [];
      mixin({
        hello() {
          log.push('hello');
        }
      });
      mixin({
        world() {
          log.push('world');
        }
      });
      const Env = defineEnvironment();
      expect(Env).to.have.property('name', 'Hello');
      const env = new Env();
      env.hello();
      env.world();
      expect(log).to.eql([ 'hello', 'world' ]);
    })
  })
  describe('mixin', function() {
    it('should return object given', function() {
      const object = {};
      expect(mixin(object)).to.equal(object);
    })
  })
})
