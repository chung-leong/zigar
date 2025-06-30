import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { TypeMismatch } from '../../src/errors.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Feature: env-variables', function() {
  describe('getEnvVariables', function() {
    it('should obtain variables from event listener', function() {
      const env = new Env();
      env.addListener('env', () => {
        return {
          HELLO: 1,
          WORLD: 123,
        };
      });
      const vars = env.getEnvVariables();
      expect(vars).to.be.an('array');
      expect(vars).to.have.lengthOf(2);
      expect(vars[0]).to.have.lengthOf(7);
      expect(vars[1]).to.have.lengthOf(9);
    })
    it('should return empty array when there is no listener', function() {
      const env = new Env();
      const vars = env.getEnvVariables();
      expect(vars).to.be.an('array');
      expect(vars).to.have.lengthOf(0);
    })
    it('should throw error when listener returns a non-object', function() {
      const env = new Env();
      env.addListener('env', () => 1234);
      expect(() => env.getEnvVariables()).to.throw(TypeMismatch);
    })
  })
})

