CREATE TABLE posts (
  id INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  date INTEGER NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  FOREIGN KEY(author_id) REFERENCES users(id),
  PRIMARY KEY(id)
);
CREATE INDEX posts_idx_date_desc ON posts(date DESC);
