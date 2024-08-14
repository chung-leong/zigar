import { requireDataView } from './data-view';
import { defineProperties, ObjectCache } from './object';
import { MEMORY, METHOD } from './symbol';

export function defineFunction(structure, env) {
  const {
    instance: { members: [ member ], template },
  } = structure;
  const cache = new ObjectCache();
  const { structure: { constructor: Arg, instance: { members: argMembers } } } = member;
  const constructor = structure.constructor = function(arg) {
    const dv = requireDataView(structure, arg, env);
    let self;
    if (self = cache.find(dv)) {
      return self;
    }
    self = function(...args) {
      const thunkAddr = env.getViewAddress(template[MEMORY]);
      const funcAddr = env.getViewAddress(self[MEMORY]);
      return env.invokeThunk(thunkAddr, funcAddr, new Arg(args, self.name, 0));
    };
    self[MEMORY] = dv;
    defineProperties(self, {
      constructor: { value: constructor },
      length: { value: argMembers.length - 1 },
    });
    // TODO: check argument
    const method = self[METHOD] = function(...args) {
      const thunkAddr = env.getViewAddress(template[MEMORY]);
      const funcAddr = env.getViewAddress(self[MEMORY]);
      return env.invokeThunk(thunkAddr, funcAddr, new Arg([ this, ...args ], method.name, 1));
    };
    method[MEMORY] = dv;
    defineProperties(method, {
      constructor: { value: constructor },
      length: { value: argMembers.length - 2 },
      name: { get: () => self.name },
    });
    return self;
  };
  return constructor;
}
