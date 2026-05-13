import pandas as pd
import requests
import os
import time

CSV_PATH = r"D:\시작\gympick\export_All-GYM-Machines.csv"
OUTPUT_DIR = r"D:\시작\gympick\machine_card_image"

os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(CSV_PATH)
print(f"Loaded {len(df)} rows from CSV")
print(f"Columns: {list(df.columns)}")

ok = skip = fail = 0

for idx, row in df.iterrows():
    image_url = str(row['image']).strip()
    machine_code = str(row['machine code']).strip()

    if not image_url or image_url == 'nan':
        print(f"[FAIL] Row {idx}: no image URL")
        fail += 1
        continue

    if not machine_code or machine_code == 'nan':
        print(f"[FAIL] Row {idx}: no machine code")
        fail += 1
        continue

    if image_url.startswith('//'):
        image_url = 'https:' + image_url

    filename = machine_code if machine_code.endswith('.webp') else machine_code + '.webp'
    filepath = os.path.join(OUTPUT_DIR, filename)

    if os.path.exists(filepath):
        print(f"[SKIP] {filename}")
        skip += 1
        continue

    try:
        resp = requests.get(image_url, timeout=15)
        resp.raise_for_status()
        with open(filepath, 'wb') as f:
            f.write(resp.content)
        print(f"[OK] {filename}")
        ok += 1
    except Exception as e:
        print(f"[FAIL] {filename}: {e}")
        fail += 1

    time.sleep(0.05)

print(f"\nDone. OK={ok}, SKIP={skip}, FAIL={fail}")
