import module, { User } from './delete-example-1.zig';

// object in JavaScript memory
const user = new User({ first_name: 'Abraham', last_name: 'Lincoln' });
user.delete();
try {
  console.log(user.valueOf());
} catch (err) {
  console.log(err.message);
}

// object in Zig memory
module.current_user = { first_name: 'Abraham', last_name: 'Lincoln' };
module.current_user.first_name.delete();
module.current_user.last_name.delete();
module.current_user.delete();
try {
  console.log(module.current_user.valueOf());
} catch (err) {
  console.log(err.message);
}