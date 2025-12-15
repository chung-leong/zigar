CREATE VIRTUAL TABLE search USING fts5(title, excerpt, content, slug UNINDEXED, content=posts, content_rowid=id);
CREATE TRIGGER search_insert AFTER INSERT ON posts BEGIN
  INSERT INTO search (rowid, title, excerpt, content, slug)
  VALUES (new.id, new.title, new.excerpt, new.content, new.slug);
END;
CREATE TRIGGER search_delete AFTER DELETE ON posts BEGIN
  INSERT INTO search (search, rowid, title, excerpt, content, slug)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content, old.slug);
END;
CREATE TRIGGER search_update AFTER UPDATE ON posts BEGIN
  INSERT INTO search (rowid, title, excerpt, content, slug)
  VALUES (new.id, new.title, new.excerpt, new.content, new.slug);
  INSERT INTO search (search, rowid, title, excerpt, content, slug)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content, old.slug);
END;
