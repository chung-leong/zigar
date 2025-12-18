import { use, useEffect, useRef } from "react";
import { isPromise } from "../utils";
import Html from "./Html";

function PostListing({ post }) {
  const categories = post.categories.split(',');
  const tags = post.tags.split(',').filter(t => !!t);
  const [ catName, catSlug ] = categories[0].split('|');
  const url = `/${catSlug}/${post.slug}/`;
  const date = new Date(post.date).toLocaleDateString();
  const [ authorName, authorSlug ] = post.author.split('|');
  const authorUrl = `/authors/${authorSlug}/`;
  return (
    <li className="PostListing">
      <div className="date">{date}</div>
      <div className="title">
        <a href={url}><Html content={post.title} /></a>
      </div>
      <div className="excerpt">
        <Html content={post.excerpt} />
      </div>
      <div className="author">
        by <a href={authorUrl}>{authorName}</a>
      </div>
      <div className="tags">
        {
          tags.map((t, i) => {
            const [ name, slug ] = t.split('|');
            const url = `/tags/${slug}/`;
            return <a key={i} href={url}>{name}</a>;
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