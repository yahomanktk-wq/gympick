"""
Step 4: 변경된 파일 Supabase Storage 재업로드 (service_role 키 사용)
Step 5: DB machines 테이블 image_url 공백 → 언더스코어 업데이트
"""

import os
import requests

FOLDER = r"D:\시작\gympick\machine_card_image\변경 후"
SUPABASE_URL = "https://okrouzqqvfioodfieljv.supabase.co"
SERVICE_KEY = "REMOVED_SECRET"
BUCKET = "machine-images"

HEADERS = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "apikey": SERVICE_KEY,
}

# ── Step 4: 공백→언더스코어로 이미 변경된 파일들 업로드 ──────────────────────

all_files = os.listdir(FOLDER)
# 공백이 없는 파일 중 원래 공백이 있었을 파일 = 언더스코어 포함 webp
# 실제로는 폴더의 모든 .webp를 upsert 업로드 (이미 변경된 것들)
# 안전하게: 현재 폴더의 모든 파일 업로드 (upsert=true)
webp_files = [f for f in all_files if f.endswith(".webp")]
print(f"[4] 업로드 대상 파일 수: {len(webp_files)}")

upload_ok = 0
upload_fail = 0
for i, fname in enumerate(webp_files):
    file_path = os.path.join(FOLDER, fname)
    with open(file_path, "rb") as f:
        data = f.read()
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{fname}",
        headers={
            **HEADERS,
            "Content-Type": "image/webp",
            "x-upsert": "true",
        },
        data=data,
    )
    if resp.status_code in (200, 201):
        upload_ok += 1
        if upload_ok % 50 == 0:
            print(f"[4] 업로드 진행: {upload_ok}/{len(webp_files)}")
    else:
        upload_fail += 1
        print(f"[4] 업로드 실패: {fname} → {resp.status_code} {resp.text[:150]}")

print(f"[4] 업로드 완료: {upload_ok}개, 실패: {upload_fail}개")

# ── Step 5: DB machines 테이블 image_url 공백 → 언더스코어 업데이트 ──────────

resp = requests.get(
    f"{SUPABASE_URL}/rest/v1/machines",
    headers={**HEADERS, "Content-Type": "application/json"},
    params={"select": "id,image_url", "limit": "10000"},
)
if resp.status_code != 200:
    print(f"[5] DB 조회 실패: {resp.status_code} {resp.text[:200]}")
else:
    rows = resp.json()
    targets = [(r["id"], r["image_url"]) for r in rows if r.get("image_url") and " " in r["image_url"]]
    print(f"[5] 업데이트 대상 행: {len(targets)}개")
    updated = 0
    failed = 0
    for mid, old_url in targets:
        new_url = old_url.replace(" ", "_")
        patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/machines",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
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
