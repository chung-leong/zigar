import module, { printCurrentUser } from './variable-example-2.zig';

printCurrentUser();
module.current_user.delete();
module.current_user = { name: 'joker1999', role: 'clown' };
printCurrentUser();
