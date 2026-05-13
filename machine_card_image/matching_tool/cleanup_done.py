import json
from pathlib import Path
from io import BytesIO
from PIL import Image
import imagehash

TARGET_DIR    = Path(r"D:\시작\gympick\machine_card_image\변경 대상")
OUTPUT_DIR    = Path(r"D:\시작\gympick\machine_card_image\변경 후")
PROGRESS_FILE = Path(r"D:\시작\gympick\machine_card_image\matching_tool\progress.json")

print("=== 완료된 파일 정리 스크립트 ===\n")

target_files = sorted(TARGET_DIR.glob("*.png"))
output_files = sorted(OUTPUT_DIR.glob("*.webp"))

print(f"변경 대상: {len(target_files)}개 PNG")
print(f"변경 완료: {len(output_files)}개 WebP\n")

if len(output_files) == 0:
    print("변경 후 폴더가 비어 있습니다. 정리할 파일 없음.")
    exit(0)

# Build phash index of completed output files
print("완료된 파일 해시 인덱싱 중...")
output_hashes = {}
for p in output_files:
    try:
        img = Image.open(p).convert("RGB")
        h = imagehash.phash(img, hash_size=16)
        output_hashes[h] = p
    except Exception as e:
        print(f"  [WARN] {p.name}: {e}")
print(f"  {len(output_hashes)}개 인덱싱 완료\n")

# Find target PNGs that match any completed output (distance <= 8)
print("매칭 중...")
to_delete = []
for t in target_files:
    try:
        img = Image.open(t).convert("RGB")
        t_hash = imagehash.phash(img, hash_size=16)
        best_dist = None
        best_match = None
        for o_hash, o_path in output_hashes.items():
            d = t_hash - o_hash
            if best_dist is None or d < best_dist:
                best_dist = d
                best_match = o_path
        if best_dist is not None and best_dist <= 8:
            to_delete.append((t, best_match, best_dist))
            print(f"  [중복] {t.name} → {best_match.name} (dist={best_dist})")
    except Exception as e:
        print(f"  [ERROR] {t.name}: {e}")

print(f"\n삭제 대상: {len(to_delete)}개 / 전체 {len(target_files)}개")

if len(to_delete) == 0:
    print("삭제할 파일 없음.")
    exit(0)

print("\n정말 삭제하시겠습니까? (yes 입력 후 Enter)")
confirm = input("> ").strip().lower()
if confirm != "yes":
    print("취소되었습니다.")
    exit(0)

# Delete matched target files
deleted = 0
used_cards = []
for t, match, dist in to_delete:
    try:
        t.unlink()
        used_cards.append(match.stem)
        deleted += 1
    except Exception as e:
        print(f"  [ERROR] {t.name}: {e}")

print(f"\n{deleted}개 삭제 완료")

# Update progress.json
remaining = sorted(TARGET_DIR.glob("*.png"))
progress = {
    "idx": 0,
    "matched": len(used_cards),
    "skipped": 0,
    "used_cards": used_cards,
    "brand_order": []
}
with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
    json.dump(progress, f, ensure_ascii=False, indent=2)

print(f"progress.json 업데이트 완료")
print(f"  남은 변경 대상: {len(remaining)}개")
print(f"  매칭 완료 처리: {len(used_cards)}개")
print(f"\n이제 app.py를 실행하면 남은 파일부터 이어서 작업할 수 있습니다.")
