import os
import shutil
from pathlib import Path
from PIL import Image
import imagehash

# Folder paths
REF_DIR       = Path(r"D:\시작\gympick\machine_card_image\기존 사진")
TARGET_DIR    = Path(r"D:\시작\gympick\machine_card_image\변경 대상")
OUTPUT_DIR    = Path(r"D:\시작\gympick\machine_card_image\변경 후")
NO_MATCH_DIR  = Path(r"D:\시작\gympick\machine_card_image\일치항목 없음")

# Hash distance threshold
# 0 = identical only, 5 = strict (safe for same-source resized images)
THRESHOLD = 5

# Create output folders
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
NO_MATCH_DIR.mkdir(parents=True, exist_ok=True)

# Step 1: Build hash index from reference machine card images (webp)
print("=== Building reference hash index ===")
ref_hashes = {}  # hash -> filepath
ref_files = list(REF_DIR.glob("*.webp"))
for i, ref_path in enumerate(ref_files):
    try:
        img = Image.open(ref_path).convert("RGB")
        h = imagehash.phash(img, hash_size=16)
        ref_hashes[h] = ref_path
        if (i + 1) % 100 == 0:
            print(f"  Indexed {i+1}/{len(ref_files)}...")
    except Exception as e:
        print(f"  [WARN] Cannot index {ref_path.name}: {e}")

print(f"Reference index complete: {len(ref_hashes)} images\n")

# Step 2: Match each target PNG against reference index
target_files = list(TARGET_DIR.glob("*.png"))
print(f"=== Processing {len(target_files)} target images ===\n")

matched       = 0
unmatched     = 0
matched_refs  = {}  # ref filename -> list of matched target filenames (duplicate detection)

for target_path in target_files:
    try:
        img = Image.open(target_path).convert("RGB")
        target_hash = imagehash.phash(img, hash_size=16)

        # Find closest match in reference index
        best_dist = None
        best_ref  = None
        for ref_hash, ref_path in ref_hashes.items():
            dist = target_hash - ref_hash
            if best_dist is None or dist < best_dist:
                best_dist = dist
                best_ref  = ref_path

        if best_dist is not None and best_dist <= THRESHOLD:
            # Duplicate match warning
            ref_key = best_ref.name
            if ref_key in matched_refs:
                print(f"[DUPLICATE MATCH] {best_ref.name} matched again!")
                print(f"  prev: {matched_refs[ref_key]}")
                print(f"  curr: {target_path.name}")
            matched_refs[ref_key] = target_path.name

            # Save as webp with reference filename
            new_name = best_ref.stem + ".webp"
            out_path = OUTPUT_DIR / new_name
            img.save(out_path, "WEBP", quality=90)
            print(f"[MATCH] {target_path.name}")
            print(f"     -> {new_name}  (distance={best_dist})")
            matched += 1
        else:
            # No match: copy original to no-match folder
            no_match_path = NO_MATCH_DIR / target_path.name
            shutil.copy2(target_path, no_match_path)
            dist_info = f"best_dist={best_dist}" if best_dist is not None else "no_ref"
            print(f"[NO MATCH] {target_path.name}  ({dist_info})")
            unmatched += 1

    except Exception as e:
        print(f"[ERROR] {target_path.name}: {e}")
        unmatched += 1

# Summary
print(f"\n{'='*50}")
print(f"완료:")
print(f"  매칭 성공: {matched}개  -> {OUTPUT_DIR}")
print(f"  매칭 실패: {unmatched}개 -> {NO_MATCH_DIR}")
print(f"  전체:      {len(target_files)}개")
