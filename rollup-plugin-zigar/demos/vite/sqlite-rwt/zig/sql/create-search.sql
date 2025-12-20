CREATE VIRTUAL TABLE search USING fts5(
  title, 
  excerpt, 
  content, 
  slug UNINDEXED,
  date UNINDEXED,
  author_id UNINDEXED,
  content=posts, 
  content_rowid=id
);
CREATE TRIGGER search_insert AFTER INSERT ON posts BEGIN
  INSERT INTO search (rowid, title, excerpt, content, slug, date, author_id)
  VALUES (new.id, new.title, new.excerpt, new.content, new.slug, new.date, new.author_id);
END;
CREATE TRIGGER search_delete AFTER DELETE ON posts BEGIN
  INSERT INTO search (search, rowid, title, excerpt, content, slug, date, author_id)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content, old.slug, old.date, old.author_id);
END;
CREATE TRIGGER search_update AFTER UPDATE ON posts BEGIN
  INSERT INTO search (rowid, title, excerpt, content, slug, date, author_id)
  VALUES (new.id, new.title, new.excerpt, new.content, new.slug, new.date, new.author_id);
  INSERT INTO search (search, rowid, title, excerpt, content, slug, date, author_id)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content, old.slug, old.date, old.author_id);
END;
