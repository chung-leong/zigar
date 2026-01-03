SELECT 
  a.slug,
  a.date,
  highlight(search, 0, '<mark>', '</mark>') as title,
  highlight(search, 1, '<mark>', '</mark>') as excerpt,
  NULL as content,
  b.name || '|' || b.slug AS author, 
  (
	SELECT group_concat(d.name || '|' || d.slug, ',') 
	FROM post_tags c 
	INNER JOIN tags d ON c.tag_id = d.id 
	WHERE c.post_id = a.rowid
  ) AS tags,
  (
	SELECT group_concat(d.name || '|' || d.slug, ',') 
	FROM post_categories c 
	INNER JOIN categories d ON c.category_id = d.id 
	WHERE c.post_id = a.rowid
  ) AS categories
FROM search a 
INNER JOIN users b ON a.author_id = b.id
WHERE a.search MATCH ?
ORDER BY {s}
LIMIT ?
OFFSET ?;
