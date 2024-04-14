import module, { printCurrentUser, User } from './variable-example-2.zig';

printCurrentUser();
module.current_user = new User({ name: 'batman72', role: 'vigilante' }, { fixed: true });
printCurrentUser();
