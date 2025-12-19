import { useCallback, useEffect, useState } from "react";

function TopNav({ route, onSearch }) {
  const [ search, setSearch ] = useState(route.query.search ?? '');
  const onChange = useCallback((evt) => setSearch(evt.target.value), []);
  const onAction = useCallback(() => onSearch?.(search), [ search ]);
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
        <input type="text" value={search} placeholder="Search" onChange={onChange} />
      </form>
      <h2><a href="/">Client-side database demo</a></h2>
    </div>
  );
}

export default TopNav;
