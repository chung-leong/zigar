import { Suspense, use, useCallback, useEffect, useState } from "react";
import { isPromise } from "../utils";

function TopNav({ api, route, onSearch }) {
  const { search: currentSearch = '' } = route.params;
  const [ categories ] = useState(() => api.getCategories());
  const [ search, setSearch ] = useState(currentSearch);
  const onChange = useCallback(evt => setSearch(evt.target.value), []);
  const [ status, setStatus ] = useState('ok');
  const onAction = useCallback(() => {
    let status = 'ok';
    if (search !== currentSearch) {
      try {
        if (search) {
          api.findPosts(search, 'rank', 0, 1);
        }
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
      <h2><a href="">Client-side database demo</a></h2>
      <Suspense>
        <CategoryMenu categories={categories} route={route} />
      </Suspense>
    </div>
  );
}

function CategoryMenu({ categories, route }) {
  categories = isPromise(categories) ? use(categories) : categories;
  let currentSlug = route.parts[0];
  if (currentSlug === 'tags' || currentSlug === 'authors') {
    currentSlug = undefined;
  }
  return (
    <ul className="menu">
      {
        categories.map(({ name, slug }, i) => {
          const className = (currentSlug == slug) ? 'active' : 'inactive';
          return <li key={i} className={className}><a href={`${slug}/`}>{name}</a></li>;
        })
      }
    </ul>
  );
}

export default TopNav;
