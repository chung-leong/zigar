import { Suspense, use, useState } from "react";
import { isPromise, usePagination } from "../utils";
import Html from "../widgets/Html";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function AuthorPage({ api, route, onAsyncLoad }) {
  const slug = route.parts[1];
  const [ posts, more ] = usePagination((offset, limit) => api.getPostsByAuthor(slug, offset, limit));
  const [ author ] = useState(() => api.getAuthor(slug));
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
        <Author author={author} />
        <PostList posts={posts} onBottomReached={more} />
      </Suspense>
    </div>
  );
}

function Author({ author }) {
  author = isPromise(author) ? use(author) : author;
  return (
    <div className="Author">
      <div className="title">{author.name}</div>
      <Html content={author.description} />
    </div>
  );
}

export default AuthorPage;