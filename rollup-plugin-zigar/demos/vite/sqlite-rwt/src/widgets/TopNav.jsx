import { useCallback, useEffect, useState } from "react";

function TopNav({ api, route, onSearch }) {
  const [ search, setSearch ] = useState(route.query.search ?? '');
  const [ status, setStatus ] = useState('ok');
  const onChange = useCallback((evt) => {
    setSearch(evt.target.value);
    setStatus('ok');
  }, []);
  const onAction = useCallback(async () => {
    if (search) {
      if (await api.checkSearch(search)) {
        onSearch?.(search);
      } else {
        setStatus('faulty');
      }
    }
  }, [ search ]);
  useEffect(() => {
    const timeout = setTimeout(onAction, 500);
    return () => clearTimeout(timeout);
  }, [ onAction ]);
  useEffect(() => {
    setSearch(route.query.search ?? '');
  }, [ route ]);
  return (
    <div className="TopNav">            
      <form className="search" action={onAction}>
        <input 
          className={status} 
          type="text"
          value={search} 
          placeholder="Search" 
          title={(status === 'faulty') ? 'Query contains syntax error' : undefined}
          onChange={onChange}
        />
      </form>
      <h2><a href="/">Client-side database demo</a></h2>
    </div>
  );
}

export default TopNav;
