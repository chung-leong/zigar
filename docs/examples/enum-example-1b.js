import { print } from './enum-example-1.zig';

print('dog');
print(1);
try {
  print('dingo');
} catch (err) {
  console.log(err.message);
}
