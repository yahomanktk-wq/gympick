from pathlib import Path
from PIL import Image
import imagehash

OUTPUT_DIR = Path(r"D:\시작\gympick\machine_card_image\변경 후")
TARGET_DIR = Path(r"D:\시작\gympick\machine_card_image\변경 대상")

THRESHOLD = 0  # 완전 동일한 이미지만 매칭

# Step 1: Build phash index of WebP files
print("=== 변경 후 WebP 인덱싱 중... ===")
webp_hashes = []
for p in sorted(OUTPUT_DIR.glob("*.webp")):
    try:
        img = Image.open(p).convert("RGB")
        h = imagehash.phash(img, hash_size=16)
        webp_hashes.append((h, p))
    except Exception as e:
        print(f"  [WARN] {p.name}: {e}")
print(f"  {len(webp_hashes)}개 인덱싱 완료\n")

# Step 2: Match each PNG
print("=== PNG 매칭 중... ===")
target_files = sorted(TARGET_DIR.glob("*.png"))
to_rename = []
unmatched = []

for t in target_files:
    try:
        img = Image.open(t).convert("RGB")
        t_hash = imagehash.phash(img, hash_size=16)

        best_dist = None
        best_webp = None
        for w_hash, w_path in webp_hashes:
            dist = t_hash - w_hash
            if best_dist is None or dist < best_dist:
                best_dist = dist
                best_webp = w_path

        if best_dist is not None and best_dist <= THRESHOLD:
            new_name = best_webp.stem + ".png"
            to_rename.append((t, t.parent / new_name, best_webp.stem, best_dist))
            print(f"  [MATCH] {t.name} → {new_name}  (dist={best_dist})")
        else:
            unmatched.append(t)
    except Exception as e:
        print(f"  [ERROR] {t.name}: {e}")
        unmatched.append(t)

print(f"\n매칭 성공: {len(to_rename)}개 / 매칭 실패: {len(unmatched)}개 / 전체: {len(target_files)}개")

if len(to_rename) == 0:
    print("변경할 파일 없음.")
    exit(0)

# 자동 확인 (중단 없이 실행)
renamed = 0
for src, dst, webp_stem, dist in to_rename:
    try:
        if dst.exists():
            print(f"  [SKIP] {dst.name} 이미 존재함")
            continue
        src.rename(dst)
        renamed += 1
    except Exception as e:
        print(f"  [ERROR] {src.name}: {e}")

print(f"\n완료: {renamed}개 파일명 변경")
if unmatched:
    print(f"매칭 실패 {len(unmatched)}개는 원래 파일명 유지")
