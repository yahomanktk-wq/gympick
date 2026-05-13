import csv
path = r"data/machines_clean.csv"
with open(path, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    print("HEADERS:", reader.fieldnames)
    print()
    targets = {"arsenal_back_1", "arsenal_back_3", "body_master_arm_1", "cybex_arm_11"}
    for row in reader:
        code = row.get("machine_code") or row.get("id") or ""
        if code in targets:
            print(row)