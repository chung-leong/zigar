import { mixin } from '../environment.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' ? {
  } : process.env.TARGET === 'node' ? {
    imports: {
      setMultithread: null,
      finalizeAsyncCall: null,
    },
  } : undefined) ,
});
