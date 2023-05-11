const addon = require('./build/Release/addon');

const zig = addon.load('/home/cleong/node-zig/libimport.so');

console.log(zig);
zig.hello(1234);
zig.world(45, -1, 88);