import { useCallback, useEffect, useState } from "react";

function TopNav({ api, route, onSearch }) {
  const { search: currentSearch = '' } = route.params;
  const [ search, setSearch ] = useState(currentSearch);
  const onChange = useCallback(evt => setSearch(evt.target.value), []);
  const [ status, setStatus ] = useState('ok');
  const onAction = useCallback(() => {
    let status = 'ok';
    if (search !== currentSearch) {
      try {
        api.findPosts(search, 'rank', 0, 1);
        const replace = search.startsWith(currentSearch);
        onSearch?.({ search, replace });
      } catch {
        status = 'faulty';
      }
    }
    setStatus(status);
  }, [ search, currentSearch ]);
  useEffect(() => {
    const timeout = setTimeout(onAction, 500);
    return () => clearTimeout(timeout);
  }, [ onAction ]);
  useEffect(() => setSearch(currentSearch), [ currentSearch ]);
  return (
    <div className="TopNav">            
      <form className="search" action={onAction}>
        <input className={status} type="text" value={search} placeholder="Search" onChange={onChange}/>
      </form>
      <h2><a href="/">Client-side database demo</a></h2>
    </div>
  );
}

export default TopNav;
