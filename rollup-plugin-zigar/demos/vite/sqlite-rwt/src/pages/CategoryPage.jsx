import { Suspense, use, useState } from "react";
import { isPromise, usePagination } from "../utils";
import Html from "../widgets/Html";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function CategoryPage({ api, route, onAsyncLoad }) {
  const slug = route.parts[0];
  const [ posts, more ] = usePagination((offset, limit) => api.getPostsByCategory(slug, offset, limit));
  const [ category ] = useState(() => api.getCategory(slug));
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
      <Category category={category} />
        <PostList posts={posts} onBottomReached={more} />
      </Suspense>
    </div>
  );
}

function Category({ category }) {
  category = isPromise(category) ? use(category) : category;
  return (
    <div className="Category">
      <div className="title">Category: {category.name}</div>
      <Html content={category.description} />
    </div>
  );
}

export default CategoryPage;