import shutil
from pathlib import Path
from PIL import Image
import imagehash
import numpy as np

# Folder paths
REF_DIR      = Path(r"D:\시작\gympick\machine_card_image\기존 사진")
TARGET_DIR   = Path(r"D:\시작\gympick\machine_card_image\변경 대상")
OUTPUT_DIR   = Path(r"D:\시작\gympick\machine_card_image\변경 후")
NO_MATCH_DIR = Path(r"D:\시작\gympick\machine_card_image\일치항목 없음")

THRESHOLD = 10  # phash distance threshold (same-source crop: expect 0~5)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
NO_MATCH_DIR.mkdir(parents=True, exist_ok=True)


def crop_machine_area(img: Image.Image) -> Image.Image:
    """
    머신카드 이미지에서 머신 영역만 크롭.
    1) 내부 영역 x=36~1013 (라운드 코너 테두리 제외)
    2) 회색밴드 시작점 자동 탐지 (밝기 < 150 이 10행 이상 연속)
    3) 제목 텍스트 끝점 자동 탐지 (비흰색 픽셀 < 15 이 15행 이상 연속)
    4) 그 사이 구간에서 흰배경 마스킹으로 오브젝트 bounding box 계산
    5) 20px 여백 추가
    """
    arr = np.array(img.convert("RGB"))
    h, w = arr.shape[:2]
    PAD = 20

    # 내부 x 범위 (라운드 코너 제외)
    x_start, x_end = 36, 1013
    inner = arr[:, x_start:x_end, :]

    # 회색밴드 시작점 탐지
    row_bright = inner.mean(axis=(1, 2))
    gray_start = int(h * 0.75)  # fallback
    for y in range(h // 2, h - 10):
        if row_bright[y] < 150:
            if all(row_bright[y + i] < 150 for i in range(10) if y + i < h):
                gray_start = y
                break

    # 제목 끝점 탐지
    non_white = (inner.min(axis=2) < 230).sum(axis=1)
    title_end = 0
    for y in range(50, gray_start // 2):
        if all(non_white[y + i] < 15 for i in range(15) if y + i < h):
            title_end = y
            break

    # 머신 오브젝트 bounding box
    zone = arr[title_end:gray_start, x_start:x_end, :]
    is_obj = ~((zone[:, :, 0] > 238) & (zone[:, :, 1] > 238) & (zone[:, :, 2] > 238))
    rows = np.where(is_obj.any(axis=1))[0]
    cols = np.where(is_obj.any(axis=0))[0]

    if len(rows) == 0 or len(cols) == 0:
        # 탐지 실패 시 전체 이미지 반환
        return img

    top    = max(0,    rows[0]  + title_end - PAD)
    bottom = min(h,    rows[-1] + title_end + PAD)
    left   = max(0,    cols[0]  + x_start   - PAD)
    right  = min(w,    cols[-1] + x_start   + PAD)

    return img.crop((left, top, right, bottom))


# Step 1: Build hash index from reference machine card images
print("=== Building reference hash index (with machine crop) ===")
ref_hashes = {}  # phash -> original filepath
ref_files  = list(REF_DIR.glob("*.webp"))

for i, ref_path in enumerate(ref_files):
    try:
        img    = Image.open(ref_path)
        cropped = crop_machine_area(img)
        h      = imagehash.phash(cropped.convert("RGB"), hash_size=16)
        ref_hashes[h] = ref_path
        if (i + 1) % 100 == 0:
            print(f"  Indexed {i+1}/{len(ref_files)}...")
    except Exception as e:
        print(f"  [WARN] Cannot index {ref_path.name}: {e}")

print(f"Reference index complete: {len(ref_hashes)} images\n")

# Step 2: Match each target PNG
target_files = list(TARGET_DIR.glob("*.png"))
print(f"=== Processing {len(target_files)} target images ===\n")

matched      = 0
unmatched    = 0
matched_refs = {}  # duplicate detection

for target_path in target_files:
    try:
        img         = Image.open(target_path).convert("RGB")
        target_hash = imagehash.phash(img, hash_size=16)

        # Find closest match
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
                print(f"[DUPLICATE MATCH] {best_ref.name} already matched!")
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
            # No match
            shutil.copy2(target_path, NO_MATCH_DIR / target_path.name)
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
