SELECT
  slug, 
  name, 
  description 
FROM categories
WHERE slug != 'uncategorized'
ORDER BY name
