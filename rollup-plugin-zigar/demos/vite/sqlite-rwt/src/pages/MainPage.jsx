import { Suspense, useState } from "react";
import Loading from "../widgets/Loading";
import PostList from "../widgets/PostList";

function MainPage({ api, onLoad }) {
  const [ posts, setPosts ] = useState(() => api.getPosts(0, 20));
  const more = async () => {
    const list = await posts;
    const extra = await api.getPosts(list.length, 20);
    setPosts([ ...list, ...extra ]);
  };
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnload={onLoad}/>}>
        <PostList posts={posts} onBottomReached={more} />
      </Suspense>
    </div>
  );
}

export default MainPage;