import { Suspense, use, useCallback } from "react";
import { isPromise, usePagination } from "../utils";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function SearchPage({ api, route, onAsyncLoad, onSearch }) {
  const { search, sort = 'rank' } = route.params;
  const [ posts, more ] = usePagination((offset, limit) => api.findPosts(search, sort, offset, limit));
  const count = api.findPostCount(search);
  const onOrderChange = useCallback((evt) => {
    const sort = evt.target.value;
    onSearch?.({ search, sort, replace: true });
  }, [ search, onSearch ]);
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
        <PageOrder order={sort} onChange={onOrderChange} />
        <PostCount count={count} />
        <PostList posts={posts} onBottomReached={more} />
      </Suspense>
    </div>
  );
}

function PostCount({ count }) {
  count = isPromise(count) ? use(count) : count;
  const s = (count !== 1) ? 's' : '';
  return (
    <div className="PostCount">
      {count} result{s}
    </div>
  );
}

function PageOrder({ order, onChange }) {
  return (
    <div className="PostOrder">
      <select onChange={onChange} value={order}>
        <option value="rank">Relevance</option>
        <option value="date desc">Date</option>
        <option value="date asc">Date (ascending)</option>
      </select>
    </div>
  );
}

export default SearchPage;