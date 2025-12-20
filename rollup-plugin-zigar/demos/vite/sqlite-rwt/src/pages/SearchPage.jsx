import { Suspense, use } from "react";
import { isPromise, usePagination } from "../utils";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function SearchPage({ api, route, onAsyncLoad }) {
  const { search, order = 'rank' } = route.query;
  const [ posts, more ] = usePagination((offset, limit) => api.findPosts(search, order, offset, limit));
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
    <h3 className="PostCount">
      {count} result{s}
    </h3>
  );
}

export default SearchPage;