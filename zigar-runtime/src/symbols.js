const dict = globalThis[Symbol.for('ZIGAR')] ??= {};

function __symbol(name) {
  return dict[name] ??= Symbol(name);
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
export const POINTER = symbol('pointer');
export const SENTINEL = symbol('sentinel');
export const ARRAY = symbol('array');
export const ITEMS = symbol('items');
export const TARGET = symbol('target');
export const ENTRIES = symbol('entries');
export const MAX_LENGTH = symbol('max length');
export const KEYS = symbol('keys');
export const ADDRESS = symbol('address');
export const LENGTH = symbol('length');
export const LAST_ADDRESS = symbol('last address');
export const LAST_LENGTH = symbol('last length');
export const PROXY = symbol('proxy');
export const CACHE = symbol('cache');
export const SIZE = symbol('size');
export const BIT_SIZE = symbol('bit size');
export const ALIGN = symbol('align');
export const CONST_TARGET = symbol('const target');
export const CONST_PROXY = symbol('const proxy');
export const ENVIRONMENT = symbol('environment');
export const ATTRIBUTES = symbol('attributes');
export const PRIMITIVE = symbol('primitive');
export const GETTERS = symbol('getters');
export const SETTERS = symbol('setters');
export const TYPED_ARRAY = symbol('typed array');
export const THROWING = symbol('throwing');
export const PROMISE = symbol('promise');
export const CALLBACK = symbol('callback');
export const FALLBACK = symbol('fallback');
export const SIGNATURE = symbol('signature');

export const UPDATE = symbol('update');
export const RESTORE = symbol('restore');
export const RESET = symbol('resetter');
export const VIVIFICATE = symbol('vivificate');
export const VISIT = symbol('visit');
export const COPY = symbol('copy');
export const SHAPE = symbol('shape');
export const INITIALIZE = symbol('initialize');
export const FINALIZE = symbol('finalize');
export const CAST = symbol('cast');
