"""
1. 로컬 '변경 후' 폴더에서 파일명 공백 → 언더스코어 변경
2. Supabase Storage에서 공백 포함 파일 삭제
3. 변경된 파일 Supabase Storage에 재업로드 (upsert)
4. DB machines 테이블의 image_url 공백 → 언더스코어 업데이트
"""

import os
import requests

FOLDER = r"D:\시작\gympick\machine_card_image\변경 후"
SUPABASE_URL = "https://okrouzqqvfioodfieljv.supabase.co"
SUPABASE_KEY = "sb_publishable_f3GrrwmhqQFyuI_1wQV6zw_Q6kF27qI"
BUCKET = "machine-images"

HEADERS_AUTH = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
}

# ── Step 1: 공백 있는 파일 목록 수집 ─────────────────────────────────────────

all_files = os.listdir(FOLDER)
files_with_spaces = [f for f in all_files if " " in f]
print(f"[1] 공백 포함 파일 수: {len(files_with_spaces)}")

# ── Step 2: Supabase Storage 에서 공백 파일 삭제 ──────────────────────────────

CHUNK = 100  # API 한 번에 최대 100개
deleted_total = 0
for i in range(0, len(files_with_spaces), CHUNK):
    chunk = files_with_spaces[i:i+CHUNK]
    resp = requests.delete(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}",
        headers={**HEADERS_AUTH, "Content-Type": "application/json"},
        json={"prefixes": chunk},
    )
    if resp.status_code in (200, 204):
        deleted_total += len(chunk)
        print(f"[2] 삭제 완료 ({i+len(chunk)}/{len(files_with_spaces)})")
    else:
        print(f"[2] 삭제 실패 chunk {i}: {resp.status_code} {resp.text[:200]}")

print(f"[2] 총 삭제: {deleted_total}개")

# ── Step 3: 로컬 파일명 공백 → 언더스코어 변경 ───────────────────────────────

renamed = []  # [(old_name, new_name), ...]
for fname in files_with_spaces:
    new_name = fname.replace(" ", "_")
    old_path = os.path.join(FOLDER, fname)
    new_path = os.path.join(FOLDER, new_name)
    if old_path != new_path:
        os.rename(old_path, new_path)
        renamed.append((fname, new_name))

print(f"[3] 로컬 파일명 변경: {len(renamed)}개")

# ── Step 4: 변경된 파일 Supabase Storage 재업로드 ────────────────────────────

upload_ok = 0
upload_fail = 0
for old_name, new_name in renamed:
    file_path = os.path.join(FOLDER, new_name)
    with open(file_path, "rb") as f:
        data = f.read()
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{new_name}",
        headers={
            **HEADERS_AUTH,
            "Content-Type": "image/webp",
            "x-upsert": "true",
        },
        data=data,
    )
    if resp.status_code in (200, 201):
        upload_ok += 1
        if upload_ok % 50 == 0:
            print(f"[4] 업로드 진행: {upload_ok}/{len(renamed)}")
    else:
        upload_fail += 1
        print(f"[4] 업로드 실패: {new_name} → {resp.status_code} {resp.text[:150]}")

print(f"[4] 업로드 완료: {upload_ok}개, 실패: {upload_fail}개")

# ── Step 5: DB machines 테이블 image_url 업데이트 ────────────────────────────

# 공백이 포함된 image_url 행 전체 조회
resp = requests.get(
    f"{SUPABASE_URL}/rest/v1/machines",
    headers={**HEADERS_AUTH, "Content-Type": "application/json"},
    params={"select": "id,image_url", "image_url": "like.*%20*", "limit": "10000"},
)
if resp.status_code != 200:
    print(f"[5] DB 조회 실패: {resp.status_code} {resp.text[:200]}")
else:
    rows = resp.json()
    print(f"[5] 업데이트 대상 행: {len(rows)}개")
    updated = 0
    failed = 0
    for row in rows:
        mid = row["id"]
        old_url = row["image_url"]
        if old_url and " " in old_url:
            new_url = old_url.replace(" ", "_")
            patch = requests.patch(
                f"{SUPABASE_URL}/rest/v1/machines",
                headers={**HEADERS_AUTH, "Content-Type": "application/json", "Prefer": "return=minimal"},
                params={"id": f"eq.{mid}"},
                json={"image_url": new_url},
            )
            if patch.status_code in (200, 204):
                updated += 1
            else:
                failed += 1
                print(f"[5] 업데이트 실패 {mid}: {patch.status_code} {patch.text[:150]}")
    print(f"[5] DB 업데이트 완료: {updated}개, 실패: {failed}개")

print("\n=== 모든 작업 완료 ===")
