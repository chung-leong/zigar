import { expect } from 'chai';

import {
  defineClass,
  defineEnvironment,
  mixin,
  name,
  reset,
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
    it('should throw when the same mixin is listed twoce', function() {
      const mixin = {};
      expect(() => defineClass('Hello', [ mixin, mixin ])).to.throw();
    })
    it('should track mixin usage', function() {
      const log = [];
      const mixin1 = {
        hello() {
          log.push('hello');
        }
      };
      const mixin2 = {
        world() {
          log.push('world');
        }
      };
      const Env = defineClass('Hello', [ mixin1, mixin2 ]);
      expect(Env).to.have.property('name', 'Hello');
      const env = new Env();
      env.trackingMixins = true;
      env.hello();
      expect(log).to.eql([ 'hello' ]);
      expect(env.mixinUsage.get(mixin1)).to.be.true;
      expect(env.mixinUsage.get(mixin2)).to.be.undefined;
    })
    it('should omit mixin usage tracking when env variable is not set', function() {
      const before = process.env.MIXIN;
      try {
        process.env.MIXIN = '';
        const mixin = {
          hello() {
            log.push('hello');
          }
        };
        const Env = defineClass('Hello', [ mixin ]);
        const env = new Env();
        expect(env.mixinUsage).to.be.undefined;
      } finally {
        process.env.MIXIN = before;
      }
    })
  })
  describe('defineEnvironment', function() {
    it('should define a class using collected info', function() {
      reset();
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
