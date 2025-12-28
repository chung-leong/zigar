import { use, useEffect, useRef } from "react";
import { isPromise } from "../utils";
import Html from "./Html";

function PostListing({ post }) {
  const categories = post.categories.split(',');
  const tags = post.tags.split(',').filter(t => !!t);
  const [ catName, catSlug ] = categories[0].split('|');
  const date = new Date(post.date).toLocaleDateString();
  const [ authorName, authorSlug ] = post.author.split('|');
  return (
    <li className="PostListing">
      <div className="date">{date}</div>
      <div className="title">
        <a href={`${catSlug}/${post.slug}/`}><Html content={post.title} /></a>
      </div>
      <div className="excerpt">
        <Html content={post.excerpt} />
      </div>
      <div className="author">
        by <a href={`authors/${authorSlug}/`}>{authorName}</a>
      </div>
      <div className="tags">
        {
          tags.map((t, i) => {
            const [ name, slug ] = t.split('|');
            return <a key={i} href={`tags/${slug}/`}>{name}</a>;
          })
        }
      </div>
    </li>
  );
}

function PostList({ posts, onBottomReached }) {
  posts = isPromise(posts) ? use(posts) : posts;
  const bottom = useRef();
  useEffect(() => {
    const callback = (entries) => {
      if (entries[0].isIntersecting) {
        onBottomReached?.();
      }
    };
    const observer = new IntersectionObserver(callback, { rootMargin: '0px 0px 1000px 0px' });
    observer.observe(bottom.current);
    return () => observer.disconnect();
  }, [ onBottomReached ]);
  return (
    <ul className="PostList">
      {posts.map((p, i) => <PostListing key={i} post={p} />)}
      <div ref={bottom} />
    </ul>
  );
}

export default PostList;