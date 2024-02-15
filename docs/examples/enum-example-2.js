import { JunkFood, default as module, print } from './enum-example-2.zig';

console.log(`donut? ${module.junk === JunkFood.donut}`);
module.junk = JunkFood.taco; 
console.log(`taco? ${module.junk === JunkFood.taco}`);
print();
module.junk = 101;
console.log(`mystery food #100? ${module.junk === JunkFood(100)}`);
console.log(`mystery food #101? ${module.junk === JunkFood(101)}`);
print();
