import { Suspense, use, useCallback } from "react";
import { isPromise, usePagination } from "../utils";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function SearchPage({ api, route, onAsyncLoad }) {
  const { search, sort = 'rank' } = route.params;
  const [ posts, more ] = usePagination((offset, limit) => api.findPosts(search, sort, offset, limit));
  const count = api.findPostCount(search);
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
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

function PageOrder({ order }) {
  const onChange = useCallback((evt) => {
    const { location, history } = window;
    const url = new URL(location);
    const order = evt.target.value;
    if (order === 'rank') {
      url.searchParams.delete('order');
    } else {
      url.searchParams.set('order', order);
    }
    history.replaceState({}, '', url);
  })
  return (
    <div className="PostOrder">
      <select onChange={onChange} value={order}>
        <option value="rank">Relevance</option>
        <option value="date-desc">Date</option>
        <option value="date-asc">Date (ascending)</option>
      </select>
    </div>
  );
}

export default SearchPage;