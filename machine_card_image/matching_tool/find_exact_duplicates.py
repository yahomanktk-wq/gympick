import hashlib
from pathlib import Path
from io import BytesIO
from PIL import Image

TARGET_DIR = Path(r"D:\시작\gympick\machine_card_image\변경 대상")
OUTPUT_DIR = Path(r"D:\시작\gympick\machine_card_image\변경 후")

def img_to_webp_bytes(path, quality=90):
    """이미지를 WebP 바이트로 변환"""
    buf = BytesIO()
    Image.open(path).convert("RGB").save(buf, format="WEBP", quality=quality)
    return buf.getvalue()

def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()

# 변경 후 폴더의 모든 webp를 MD5 해시로 인덱싱
print("=== 변경 후 폴더 인덱싱 중... ===")
output_hashes = {}  # md5 -> filepath
output_files = list(OUTPUT_DIR.glob("*.webp"))
for p in output_files:
    try:
        h = md5(p.read_bytes())
        output_hashes[h] = p
    except Exception as e:
        print(f"  [WARN] {p.name}: {e}")
print(f"  {len(output_hashes)}개 인덱싱 완료\n")

# 변경 대상 PNG를 webp로 변환 후 MD5 비교
print("=== 변경 대상 PNG 비교 중... ===")
target_files = sorted(TARGET_DIR.glob("*.png"))
to_delete = []

for i, t in enumerate(target_files):
    try:
        webp_bytes = img_to_webp_bytes(t, quality=90)
        h = md5(webp_bytes)
        if h in output_hashes:
            matched = output_hashes[h]
            to_delete.append((t, matched))
            print(f"  [일치] {t.name} → {matched.name}")
        if (i + 1) % 100 == 0:
            print(f"  {i+1}/{len(target_files)} 처리 중...")
    except Exception as e:
        print(f"  [ERROR] {t.name}: {e}")

print(f"\n결과: {len(to_delete)}개 중복 발견 / 전체 {len(target_files)}개")

if len(to_delete) == 0:
    print("삭제할 파일 없음.")
    exit(0)

print("\n삭제를 진행하시겠습니까? (yes 입력 후 Enter)")
confirm = input("> ").strip().lower()
if confirm != "yes":
    print("취소되었습니다.")
    exit(0)

deleted = 0
for t, matched in to_delete:
    try:
        t.unlink()
        deleted += 1
    except Exception as e:
        print(f"  [ERROR] {t.name}: {e}")

print(f"\n완료: {deleted}개 삭제")
print(f"남은 변경 대상: {len(target_files) - deleted}개")
