import { useCallback, useEffect, useState } from "react";

function TopNav({ api, route, onSearch }) {
  const { search: currentSearch = '' } = route.params;
  const [ search, setSearch ] = useState(currentSearch);
  const onChange = useCallback(evt => setSearch(evt.target.value), []);
  const onAction = useCallback(() => {
    if (search !== currentSearch) {
      onSearch?.({ search });
    }
  }, [ search, currentSearch ]);
  useEffect(() => {
    const timeout = setTimeout(onAction, 500);
    return () => clearTimeout(timeout);
  }, [ onAction ]);
  useEffect(() => setSearch(currentSearch), [ currentSearch ]);
  return (
    <div className="TopNav">            
      <form className="search" action={onAction}>
        <input type="text" value={search} placeholder="Search" onChange={onChange}
        />
      </form>
      <h2><a href="/">Client-side database demo</a></h2>
    </div>
  );
}

export default TopNav;
