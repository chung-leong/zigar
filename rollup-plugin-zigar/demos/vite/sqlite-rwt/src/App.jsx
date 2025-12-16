import { useEffect, useState } from 'react';
import { __zigar, database, remote } from '../zig/backend.zig';
import './App.css';
import rwt from './assets/rwt.db';
import MainPage from './pages/MainPage.jsx';
import { WebFile } from './web-file.js';
import TopNav from './widgets/TopNav.jsx';

const remoteFile = WebFile.create(rwt);
let localFile = null;

__zigar.on('open', ({ path }) => {
  switch (path) {
    case 'remote.db':
      return remoteFile;
    case 'local.db':
      return localFile;
    default: return false;
  }
});
__zigar.on('mkdir', () => true);
__zigar.on('rmdir', () => true);

await remote.open('/remote.db');
await remote.close();

function App() {
  const [ api, setApi ] = useState(() => remote);
  let Page = MainPage;
  useEffect(() => {
    return () => database.close();
  }, [ remote, database ])
  return (
    <div className="App">
      <TopNav />
      <Page api={api} />
    </div>
  );
}

export default App
