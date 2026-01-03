CREATE TABLE post_categories (
  post_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  FOREIGN KEY(category_id) REFERENCES categories(id),
  FOREIGN KEY(post_id) REFERENCES posts(id)
);
CREATE UNIQUE INDEX post_categories_idx ON post_categories (
  post_id,
  category_id
);
CREATE INDEX post_categories_idx_category_id ON post_categories(category_id);
