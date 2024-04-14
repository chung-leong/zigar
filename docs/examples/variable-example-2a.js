import module, { printCurrentUser, User } from './variable-example-2.zig';

printCurrentUser();
try {
    module.current_user = new User({ name: 'batman72', role: 'vigilante' });
} catch (err) {
    console.log(err.message);
}
