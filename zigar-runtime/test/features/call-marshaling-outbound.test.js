import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import CallMarshalingOutbound, {
  CallContext,
  isNeededByStructure,
} from '../../src/features/call-marshaling-outbound.js';
import { StructureType } from '../../src/structures/all.js';

const Env = defineClass('FeatureTest', [ CallMarshalingOutbound ]);

describe('Feature: call-marshaling-outbound', function() {
  describe('isNeededByStructure', function() {
    it('should return true when structure is a function', function() {
      const structure = {
        type: StructureType.Function,
        instance: {}
      };
      it('should return true when structure is not a function', function() {
        const structure = {
          type: StructureType.SinglePointer,
          instance: {
            members: [
              {
                type: MemberType.Object,
                structure: {
                  type: StructureType.Function,
                }
              }
            ]
          }
        };
        expect(isNeededByStructure(structure)).to.be.false;
      })
    })
  })
  describe('startContext', function() {
    it('should start a new context', function() {
      const env = new Env();
      env.startContext();
      try {
        expect(env.context).to.be.an.instanceOf(CallContext);
      } finally {
        env.endContext();
      }
    })
    it('should push existing context onto stack', function() {
      const env = new Env();
      env.startContext();
      const ctx1 = env.context;
      env.startContext();
      const ctx2 = env.context;
      try {
        expect(ctx2).to.not.equal(ctx1);
        expect(env.contextStack).to.be.an('array').with.lengthOf(1);
        expect(env.contextStack[0]).to.equal(ctx1);
      } finally {
        env.endContext();
        env.endContext();
      }
    })
  })
  describe('endContext', function() {
    it('should end current context', function() {
      const env = new Env();
      env.startContext();
      try {
        expect(env.context).to.be.an.instanceOf(CallContext);
      } finally {
        env.endContext();
      }
      expect(env.context).to.be.undefined;
    })
    it('should restore previous context', function() {
      const env = new Env();
      env.startContext();
      const ctx1 = env.context;
      env.startContext();
      const ctx2 = env.context;
      try {
        expect(ctx2).to.not.equal(ctx1);
      } finally {
        env.endContext();
      }
      try {
        expect(env.context).to.equal(ctx1);
      } finally {
        env.endContext();
      }
    })
  })
})