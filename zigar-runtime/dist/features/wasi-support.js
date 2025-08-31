import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { isPromise } from '../utils.js';

var wasiSupport = mixin({
  getBuiltinHandler(name) {
    const nameCamelized = name.replace(/_./g, m => m.charAt(1).toUpperCase());
    const handler = this[nameCamelized];
    if (handler) {
      const custom = this.customWASI?.wasiImport?.[name];
      if (custom && name === 'fd_prestat_get') {
        this.customPreopened = true;
      }
      return (...args) => {
        const result = handler.call(this, ...args);
        const onResult = (result) => {
          if (result === PosixError.ENOTSUP && custom) {
            // the handler has declined to deal with it, use the method from the custom WASI interface
            return custom(...args);
          } else if (result === PosixError.ENOTSUP || result === PosixError.ENOTCAPABLE) {
            // if we can't fallback onto a custom handler, explain the failure
            const evtName = this.lastEvent;
            if (evtName) {
              if (this.hasListener(evtName)) {
                console.error(`WASI method '${name}' failed because the handler for '${evtName}' declined to handle the event`);
              } else {
                console.error(`WASI method '${name}' requires the handling of the '${evtName}' event`);
              }
            }
            return PosixError.ENOTSUP;
          }
          return result;
        };
        return isPromise(result) ? result.then(onResult) : onResult(result);
      };
    }
  },
}) ;

export { wasiSupport as default };
