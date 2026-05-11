-- gym_popularity_ranking 뷰 재생성
-- (gym_favorites 테이블 생성 후 반드시 재실행 필요)

DROP VIEW IF EXISTS gym_popularity_ranking;

CREATE VIEW gym_popularity_ranking AS
SELECT
  g.id AS gym_id,
  g.name AS gym_name,
  g.location,
  COUNT(DISTINCT gf.id) AS favorite_count,
  COUNT(DISTINCT mr.id) AS review_count,
  COUNT(DISTINCT gf.id) * 2 + COUNT(DISTINCT mr.id) AS total_score
FROM gyms g
LEFT JOIN gym_favorites gf ON gf.gym_id = g.id
LEFT JOIN machine_reviews mr ON mr.gym_id = g.id
GROUP BY g.id, g.name, g.location
ORDER BY total_score DESC
LIMIT 20;
