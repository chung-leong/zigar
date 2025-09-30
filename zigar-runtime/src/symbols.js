const dict = globalThis[Symbol.for('ZIGAR')] ||= {};

function __symbol(name) {
  return dict[name] ||= Symbol(name);
}

function symbol(name) {
  return /*@__PURE__*/ __symbol(name);
}

export const MEMORY = symbol('memory');
export const SLOTS = symbol('slots');
export const PARENT = symbol('parent');
export const ZIG = symbol('zig');
export const NAME = symbol('name');
export const TYPE = symbol('type');
export const FLAGS = symbol('flags');
export const CLASS = symbol('class');
export const TAG = symbol('tag');
export const PROPS = symbol('props');
export const SENTINEL = symbol('sentinel');
export const ITEMS = symbol('items');
export const TARGET = symbol('target');
export const ENTRIES = symbol('entries');
export const MAX_LENGTH = symbol('max length');
export const KEYS = symbol('keys');
export const ADDRESS = symbol('address');
export const LENGTH = symbol('length');
export const LAST_ADDRESS = symbol('last address');
export const LAST_LENGTH = symbol('last length');
export const CACHE = symbol('cache');
export const SIZE = symbol('size');
export const BIT_SIZE = symbol('bit size');
export const ALIGN = symbol('align');
export const ENVIRONMENT = symbol('environment');
export const ATTRIBUTES = symbol('attributes');
export const PRIMITIVE = symbol('primitive');
export const GETTERS = symbol('getters');
export const SETTERS = symbol('setters');
export const TYPED_ARRAY = symbol('typed array');
export const THROWING = symbol('throwing');
export const PROMISE = symbol('promise');
export const GENERATOR = symbol('generator');
export const ALLOCATOR = symbol('allocator');
export const FALLBACK = symbol('fallback');
export const SIGNATURE = symbol('signature');
export const CONTROLLER = symbol('controller');
export const PROXY_TYPE = symbol('proxy type');
export const READ_ONLY = symbol('read only');

export const UPDATE = symbol('update');
export const RESTORE = symbol('restore');
export const RESET = symbol('reset');
export const VIVIFICATE = symbol('vivificate');
export const VISIT = symbol('visit');
export const SHAPE = symbol('shape');
export const INITIALIZE = symbol('initialize');
export const RESTRICT = symbol('restrict');
export const FINALIZE = symbol('finalize');
export const PROXY = symbol('proxy');
export const CAST = symbol('cast');
export const RETURN = symbol('return');
export const YIELD = symbol('yield');
export const TRANSFORM = symbol('transform');
