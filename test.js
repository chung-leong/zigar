const addon = require('./build/Release/addon');

const zig = addon.load('./libtest.so');

console.log(zig);
console.log(zig.integer);

const retval = zig.hello(12345);
console.log(retval);

