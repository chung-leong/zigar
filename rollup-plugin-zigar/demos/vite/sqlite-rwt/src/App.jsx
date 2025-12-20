import { useCallback, useEffect, useState } from 'react';
import { __zigar, database, remote } from '../zig/backend.zig';
import './App.css';
import rwt from './assets/rwt.db';
import ArticlePage from './pages/ArticlePage.jsx';
import AuthorPage from './pages/AuthorPage.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import MainPage from './pages/MainPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import TagPage from './pages/TagPage.jsx';
import { parseRoute } from './utils.js';
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

remote.open('/remote.db');

function App() {
  const [ api, setApi ] = useState(() => remote);
  const [ route, setRoute ] = useState(() => parseRoute(window.location));
  let Page, key;
  if (route.query.search) {
    Page = SearchPage;
    key = route.query.search;
  } else {
    switch (route.parts[0]) {
      case undefined: 
        Page = MainPage; 
        break;
      case 'authors': 
        Page = AuthorPage; 
        key = route.parts[1];
        break;
      case 'tags': 
        Page = TagPage; 
        key = route.parts[1];
        break;
      default: 
        Page = (route.parts[1]) ? ArticlePage : CategoryPage; 
        break;
    }
  }
  useEffect(() => {
    const onLinkClick = (evt) => {
      const { location, history } = window;
      const { target, button, defaultPrevented } = evt;
      if (button === 0 && !defaultPrevented) {
        const link = target.closest('A');
        if (link && !link.target && !link.download && link.origin === location.origin) {
          if (link.pathname !== location.pathname || link.search !== location.search) {
            history.pushState({}, '', link);
            setRoute(parseRoute(link, true));
          }
          evt.preventDefault();
        }
      }
    };
    const onPopState = (evt) => {
      const { location } = window;
      setRoute(parseRoute(location));
    };
    window.addEventListener('click', onLinkClick, true);
    window.addEventListener('popstate', onPopState, true);
    return () => {
      window.removeEventListener('click', onLinkClick, true);
      window.removeEventListener('popstate', onPopState, true);
    };    
  }, []);
  useEffect(() => {
    if (route.forward) {
      window.scroll(0, 0);
    }
  }, [ route ]);
  const onSearch = useCallback((search) => {
    const { location, history } = window;
    const url = new URL(location);
    const was_searching = !!url.searchParams.get('search');
    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }
    if (was_searching && search) {
      history.replaceState({}, '', url);
    } else {
      history.pushState({}, '', url);
    }
    setRoute(parseRoute(url, true));
  }, []);
  let started = false;
  const onTransition = useCallback(async () => {
    if (started) return;
    // download the file
    const response = await fetch(rwt);
    const buffer = await response.arrayBuffer();
    localFile = new Uint8Array(buffer);
    // close the database and shut down the web worker
    await remote.close();  
    remote.shutdown();  
    // reopen it using the cache file and set the API
    database.open('/local.db');
    setApi(() => database);
  }, [ database, remote ]);

  return (
    <div className="App">
      <TopNav api={api} route={route} onSearch={onSearch}/>
      <Page key={key} api={api} route={route} onAsyncLoad={onTransition}/>
    </div>
  );
}

export default App
