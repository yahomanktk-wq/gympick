import csv
import re

INPUT_PATH  = r'D:\시작\gympick\data\machines_raw.csv.csv'
OUTPUT_PATH = r'D:\시작\gympick\data\machines_clean.csv'

# ── Brand normalisation map ──────────────────────────────────────────────────
BRAND_MAP = {
    'ARSENAL':           'Arsenal',
    'ATLANTIS':          'Atlantis',
    'BODY MASTER':       'Body Master',
    'CYBEX':             'Cybex',
    'DYNAMIC':           'Dynamic',
    'DYNA BODY':         'Dyna Body',
    'FREEMOTION':        'FreeMotion',
    'GYM80':             'GYM80',
    'GYMLECO':           'Gymleco',
    'HAMMER STRENGTH':   'Hammer Strength',
    'HOIST':             'Hoist',
    'ICARIAN':           'Icarian',
    'LIFE FITNESS':      'Life Fitness',
    'MAXPUMP':           'MaxPump',
    'NAUTILUS':          'Nautilus',
    'NEWTECH':           'Newtech',
    'PANATTA':           'Panatta',
    'PARAMOUNT':         'Paramount',
    'PRECOR':            'Precor',
    'PRIME':             'Prime',
    'SINCO':             'Sinco',
    'STAR TRAC':         'Star Trac',
    'STRIVE':            'Strive',
    'TECHNOGYM':         'Technogym',
    'TELJU':             'Telju',
    'WATSON':            'Watson',
}

# ── Category normalisation map ───────────────────────────────────────────────
CATEGORY_MAP = {
    'PULL DOWN':          'Pull Down',
    'MIDDLE ROW':         'Middle Row',
    'LOW ROW':            'Low Row',
    'HIGH ROW':           'High Row',
    'T-BAR':              'T-Bar',
    'PULLOVER':           'Pullover',
    'CHIN DIP':           'Chin / Dip',
    'BICEPS':             'Biceps',
    'TRICEPS':            'Triceps',
    'LEG PRESS':          'Leg Press',
    'LEG EXTENTION':      'Leg Extension',
    'LEG CURL':           'Leg Curl',
    'HACK SQUAT':         'Hack Squat',
    'SQUAT MACHINE':      'Squat Machine',
    'PENDULUM SQUAT':     'Pendulum Squat',
    'SHOULDER PRESS':     'Shoulder Press',
    'RAISE_SIDE LATERAL': 'Side Lateral Raise',
    'VIKING PRESS':       'Viking Press',
    'CHEST PRESS':        'Chest Press',
    'FLY':                'Fly',
    'INCLINE PRESS':      'Incline Press',
    'INCLINE FLY':        'Incline Fly',
    'DECLINE PRESS':      'Decline Press',
    'CALF':               'Calf',
    'INNER OUTER':        'Inner / Outer Thigh',
    'HIP ABDUCTION':      'Hip Abduction',
    'HIP PRESS':          'Hip Press',
    'LEG_ETC':            'Leg (Other)',
    'ETC':                'Other',
    'CHEST_ETC':          'Chest (Other)',
    'SHOULDER_ETC':       'Shoulder (Other)',
    'BACK_ETC':           'Back (Other)',
    '':                   'Other',
    'ARM_ETC':            'Arms (Other)',
    'GLUTE_ETC':          'Glutes (Other)',
    'HIP THRUST':         'Hip Thrust',
    'REAR DELT':          'Rear Delt',
}

# ── Target-part map (keyed on PRIMARY category only) ────────────────────────
TARGET_PART_MAP = {
    'PULL DOWN':          'Back',
    'MIDDLE ROW':         'Back',
    'LOW ROW':            'Back',
    'HIGH ROW':           'Back',
    'T-BAR':              'Back',
    'PULLOVER':           'Back',
    'CHIN DIP':           'Back',
    'BACK_ETC':           'Back',
    'BICEPS':             'Arms',
    'TRICEPS':            'Arms',
    'ARM_ETC':            'Arms',
    'LEG PRESS':          'Legs',
    'LEG EXTENTION':      'Legs',
    'LEG CURL':           'Legs',
    'HACK SQUAT':         'Legs',
    'SQUAT MACHINE':      'Legs',
    'PENDULUM SQUAT':     'Legs',
    'CALF':               'Legs',
    'INNER OUTER':        'Legs',
    'HIP ABDUCTION':      'Legs',
    'HIP PRESS':          'Legs',
    'LEG_ETC':            'Legs',
    'GLUTE_ETC':          'Legs',
    'HIP THRUST':         'Legs',
    'CHEST PRESS':        'Chest',
    'FLY':                'Chest',
    'INCLINE PRESS':      'Chest',
    'INCLINE FLY':        'Chest',
    'DECLINE PRESS':      'Chest',
    'CHEST_ETC':          'Chest',
    'SHOULDER PRESS':     'Shoulders',
    'RAISE_SIDE LATERAL': 'Shoulders',
    'VIKING PRESS':       'Shoulders',
    'SHOULDER_ETC':       'Shoulders',
    'REAR DELT':          'Shoulders',
    'ETC':                'Other',
    '':                   'Other',
}


def make_machine_name(code):
    s = code.replace(',', '')
    s = s.replace('_', ' ')
    s = re.sub(r' +', ' ', s).strip()
    return s.title()


def make_machine_code(code):
    s = code.replace(',', '')
    s = s.replace(' ', '_')
    s = re.sub(r'_+', '_', s).strip('_')
    return s.lower()


def normalise_brand(raw):
    key = raw.strip().upper()
    return BRAND_MAP.get(key, raw.strip().title())


def normalise_category(raw):
    parts = [p.strip() for p in raw.split(',')]
    mapped = [CATEGORY_MAP.get(p, p.title()) for p in parts]
    return ' / '.join(mapped)


def get_target_part(raw):
    primary = raw.split(',')[0].strip()
    return TARGET_PART_MAP.get(primary, 'Other')


def main():
    rows_written = 0
    with open(INPUT_PATH, encoding='utf-8', newline='') as fin, \
         open(OUTPUT_PATH, 'w', encoding='utf-8', newline='') as fout:

        reader = csv.reader(fin)
        writer = csv.writer(fout)

        next(reader)  # skip header
        writer.writerow(['machine_name', 'brand', 'copyright',
                         'machine_code', 'machine_category', 'target_part'])

        for row in reader:
            if len(row) < 7:
                continue
            raw_brand    = row[1]
            raw_category = row[5]
            raw_code     = row[6]

            if not raw_code.strip():
                continue

            writer.writerow([
                make_machine_name(raw_code),
                normalise_brand(raw_brand),
                'no',
                make_machine_code(raw_code),
                normalise_category(raw_category),
                get_target_part(raw_category),
            ])
            rows_written += 1

    print(f'Done. {rows_written} rows written to {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
