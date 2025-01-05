import { closeDatabase, openDatabase } from '../zig/mysql.zig';

openDatabase({
  host: '172.17.0.2',
  username: 'zig_user',
  password: 'password123',
  database: 'testdb',
  threads: 4,
});
closeDatabase();
