CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  FOREIGN KEY(post_id) REFERENCES posts(id),
  FOREIGN KEY(tag_id) REFERENCES tags(id)
);
CREATE UNIQUE INDEX post_tags_idx ON post_tags (
  post_id,
  tag_id
);
