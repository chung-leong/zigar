SELECT
  a.slug, 
  a.date, 
  a.title, 
  a.excerpt,
  NULL as content,
  b.name || '|' || b.slug AS author, 
  (
    SELECT group_concat(d.name || '|' || d.slug, ',') 
    FROM post_tags c 
    INNER JOIN tags d ON c.tag_id = d.id 
    WHERE c.post_id = a.id
  ) AS tags,
  (
    SELECT group_concat(d.name || '|' || d.slug, ',') 
    FROM post_categories c 
    INNER JOIN categories d ON c.category_id = d.id 
    WHERE c.post_id = a.id
  ) AS categories
FROM posts_wo_contents a 
INNER JOIN users b ON a.author_id = b.id
WHERE a.id IN 
  (
    SELECT post_id 
    FROM post_categories c INNER JOIN categories d ON c.category_id = d.id 
    WHERE d.slug = ?
  )
ORDER BY a.date DESC
LIMIT ?
OFFSET ?;