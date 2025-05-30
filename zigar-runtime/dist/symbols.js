const dict = globalThis[Symbol.for('ZIGAR')] ||= {};

function __symbol(name) {
  return dict[name] ||= Symbol(name);
}

function symbol(name) {
  return /*@__PURE__*/ __symbol(name);
}

const MEMORY = symbol('memory');
const SLOTS = symbol('slots');
const PARENT = symbol('parent');
const ZIG = symbol('zig');
const NAME = symbol('name');
const TYPE = symbol('type');
const FLAGS = symbol('flags');
const CLASS = symbol('class');
const TAG = symbol('tag');
const PROPS = symbol('props');
const POINTER = symbol('pointer');
const SENTINEL = symbol('sentinel');
const ARRAY = symbol('array');
const ITEMS = symbol('items');
const TARGET = symbol('target');
const ENTRIES = symbol('entries');
const MAX_LENGTH = symbol('max length');
const KEYS = symbol('keys');
const ADDRESS = symbol('address');
const LENGTH = symbol('length');
const LAST_ADDRESS = symbol('last address');
const LAST_LENGTH = symbol('last length');
const PROXY = symbol('proxy');
const CACHE = symbol('cache');
const SIZE = symbol('size');
const BIT_SIZE = symbol('bit size');
const ALIGN = symbol('align');
const CONST_TARGET = symbol('const target');
const ENVIRONMENT = symbol('environment');
const ATTRIBUTES = symbol('attributes');
const PRIMITIVE = symbol('primitive');
const GETTERS = symbol('getters');
const SETTERS = symbol('setters');
const TYPED_ARRAY = symbol('typed array');
const THROWING = symbol('throwing');
const PROMISE = symbol('promise');
const GENERATOR = symbol('generator');
const ALLOCATOR = symbol('allocator');
const FALLBACK = symbol('fallback');
const SIGNATURE = symbol('signature');
const STRING_RETVAL = symbol('string retval');

const UPDATE = symbol('update');
const RESTORE = symbol('restore');
const RESET = symbol('reset');
const VIVIFICATE = symbol('vivificate');
const VISIT = symbol('visit');
const COPY = symbol('copy');
const SHAPE = symbol('shape');
const INITIALIZE = symbol('initialize');
const RESTRICT = symbol('restrict');
const FINALIZE = symbol('finalize');
const CAST = symbol('cast');
const RETURN = symbol('return');
const YIELD = symbol('yield');

export { ADDRESS, ALIGN, ALLOCATOR, ARRAY, ATTRIBUTES, BIT_SIZE, CACHE, CAST, CLASS, CONST_TARGET, COPY, ENTRIES, ENVIRONMENT, FALLBACK, FINALIZE, FLAGS, GENERATOR, GETTERS, INITIALIZE, ITEMS, KEYS, LAST_ADDRESS, LAST_LENGTH, LENGTH, MAX_LENGTH, MEMORY, NAME, PARENT, POINTER, PRIMITIVE, PROMISE, PROPS, PROXY, RESET, RESTORE, RESTRICT, RETURN, SENTINEL, SETTERS, SHAPE, SIGNATURE, SIZE, SLOTS, STRING_RETVAL, TAG, TARGET, THROWING, TYPE, TYPED_ARRAY, UPDATE, VISIT, VIVIFICATE, YIELD, ZIG };
