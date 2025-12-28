import { Suspense, use } from "react";
import { isPromise } from "../utils";
import Html from "../widgets/Html";
import Loading from "../widgets/Loading";

function ArticlePage({ api, route, onAsyncLoad }) {
  const slug = route.parts[1];
  const post = api.getPost(slug);
  return (
    <div className="Page">
      <Suspense fallback={<Loading onUnmount={onAsyncLoad}/>}>
        <Article post={post} />
      </Suspense>
    </div>
  );
}

function Article({ post }) {
  post = isPromise(post) ? use(post) : post;
  const tags = post.tags.split(',').filter(t => !!t);
  const [ authorName, authorSlug ] = post.author.split('|');
  const date = new Date(post.date).toLocaleDateString();
  return (
    <div className="Article">
      <div className="title"><Html content={post.title} /></div>
      <div className="author-date">
        by <a href={`authors/${authorSlug}/`}>{authorName}</a> <span className="date">({date})</span>
      </div>
      <div className="tags">
        {
          tags.map((t, i) => {
            const [ name, slug ] = t.split('|');
            return <a key={i} href={`tags/${slug}/`}>{name}</a>;
          })
        }
      </div>
      <div className="content"><Html content={post.content} /></div>
    </div>
  );
}

export default ArticlePage;