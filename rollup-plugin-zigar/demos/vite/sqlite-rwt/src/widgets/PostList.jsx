import { use, useEffect, useRef } from "react";
import { isPromise, split } from "../utils";
import Html from "./Html";

function PostList({ posts, onBottomReached }) {
  posts = isPromise(posts) ? use(posts) : posts;
  const bottom = useRef();
  useEffect(() => {
    const callback = (entries) => {
      if (entries[0].isIntersecting) {
        onBottomReached?.();
      }
    };
    const observer = new IntersectionObserver(callback, { rootMargin: '0px 0px 800px 0px' });
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

function PostListing({ post }) {
  const categories = split(post.categories);
  const tags = split(post.tags);
  const [ catName, catSlug ] = categories[0].split('|');
  const url = `/${catSlug}/${post.slug}/`;
  return (
    <li className="PostListing">
      <PublishDate timestamp={post.date} />
      <Title html={post.title} url={url} />
      <Excerpt html={post.excerpt} />
      <Author pair={post.author} />
      <TagList tags={tags} />
    </li>
  );
}

function PublishDate({ timestamp }) {
  const date = new Date(timestamp);
  const dateString = date.toLocaleDateString();
  return <div className="PublishDate">{dateString}</div>;
}

function Title({ html, url }) {
  return (
    <div className="Title">
      <a href={url}><Html content={html} /></a>
    </div>
  );
}

function Author({ pair }) {
  const [ name, slug ] = pair.split('|');
  const url = `/authors/${slug}/`;
  return (
    <div className="Author">
      by <a href={url}>{name}</a>
    </div>
  );
}

function Excerpt({ html }) {
  return (
    <div className="Excerpt">
      <Html content={html} />
    </div>
  );
}

function TagList({ tags }) {
  // if (tags.length === 0) return null;
  return (
    <div className="Tags">
      {tags.map((t, i) => <Tag key={i} pair={t} />)}
    </div>
  );
}

function Tag({ pair }) {
  const [ name, slug ] = pair.split('|');
  const url = `/tags/${slug}/`;
  return <a className="Tag" href={url}>{name}</a>;
}

export default PostList;