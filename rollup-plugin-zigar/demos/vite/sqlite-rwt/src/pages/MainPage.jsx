import { Suspense } from "react";
import { usePagination } from "../utils";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function MainPage({ api, onAsyncLoad }) {
  const [ posts, more ] = usePagination((offset, limit) => api.getPosts(offset, limit));
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
        <PostList posts={posts} onBottomReached={more} />
      </Suspense>
    </div>
  );
}

export default MainPage;