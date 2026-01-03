import { Suspense, use, useState } from "react";
import { isPromise, usePagination } from "../utils";
import Html from "../widgets/Html";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function TagPage({ api, route, onAsyncLoad }) {
  const slug = route.parts[1];
  const [ posts, more ] = usePagination((offset, limit) => api.getPostsByTag(slug, offset, limit));
  const [ tag ] = useState(() => api.getTag(slug));
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
        <Tag tag={tag} />
        <PostList posts={posts} onBottomReached={more} />
      </Suspense>
    </div>
  );
}

function Tag({ tag }) {
  tag = isPromise(tag) ? use(tag) : tag;
  return (
    <div className="Tag">
      <div className="title">Tag: {tag.name}</div>
      <Html content={tag.description} />
    </div>
  );
}

export default TagPage;