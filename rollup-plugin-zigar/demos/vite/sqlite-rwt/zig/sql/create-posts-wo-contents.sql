CREATE TABLE posts_wo_contents (
  id INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  date INTEGER NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  FOREIGN KEY(author_id) REFERENCES users(id),
  PRIMARY KEY(id)
);
CREATE INDEX posts_wo_contents_idx_date_desc ON posts_wo_contents(date DESC);
CREATE TRIGGER posts_wo_contents_insert AFTER INSERT ON posts BEGIN
  INSERT INTO posts_wo_contents (id, slug, date, title, excerpt, author_id) 
  VALUES (new.id, new.slug, new.date, new.title, new.excerpt, new.author_id);
END;
CREATE TRIGGER posts_wo_contents_delete AFTER DELETE ON posts BEGIN
  DELETE FROM posts_wo_contents WHERE id = old.id;
END;
CREATE TRIGGER posts_wo_contents_update AFTER UPDATE ON posts BEGIN
  UPDATE posts_wo_contents 
  SET slug = new.slug, date = new.date, title = new.title, excerpt = new.excerpt, author_id = new.author_id
  WHERE id = old.id;
END;
