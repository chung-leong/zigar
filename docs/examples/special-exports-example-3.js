import {
    __zigar,
    Error,
    Struct,
    StructEU,
    StructO,
    Union
} from './special-exports-example-3.zig';
const { typeOf } = __zigar;

console.log(typeOf(Error));
console.log(typeOf(Struct));
console.log(typeOf(StructEU));
console.log(typeOf(StructO));
console.log(typeOf(Union));
