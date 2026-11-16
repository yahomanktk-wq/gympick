-- (2026-11-16 Supabase에 이미 적용됨 — 기록용) 같은 라인인데 표기만 다른 데이터 통일 (31개)
update machines set line = 'ONE'          where brand = 'Nautilus'  and line = 'One';           -- 1개
update machines set line = 'Fitness Line' where brand = 'Paramount' and line = 'FITNESS LINE';  -- 7개
update machines set line = btrim(line)    where line <> btrim(line);                            -- 13개 (Nautilus 'Power Plus ')
