import { startServer, setBaseHandler, setCatHandler } from '../lib/server.zigar';
import { handleCat } from '../lib/cat.zigar';

setCatHandler(handleCat);
setBaseHandler(async (url, { allocator }) => {
  return allocator.dupe(`
<!DOCTYPE html>    
<html>
  <title>Hello world</title>
  <body>
      <h1>Hello world!</h1>
      <p>You have accessed ${url.string}</p>
  </body>
</html>
  `);
});
await startServer('0.0.0.0', 9862);
console.log(`Server running`);
