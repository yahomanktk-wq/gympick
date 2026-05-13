import csv, re

TARGET_MAP = {
    'ARM':              'Arms',
    'BACK':             'Back',
    'CHEST':            'Chest',
    'CHEST , BACK':     'Chest',
    'CHEST , SHOULDER': 'Chest',
    'ETC':              'Other',
    'GLUTE':            'Glutes',
    'GLUTE , LEG':      'Glutes',
    'LEG':              'Legs',
    'LEG , GLUTE':      'Legs',
    'SHOULDER':         'Shoulders',
    'SHOULDER , ARM':   'Shoulders',
    'SHOULDER , BACK':  'Shoulders',
    'SHOULDER , CHEST': 'Shoulders',
}

def to_id(code):
    s = code.strip().lower()
    s = re.sub(r'[\s\-]+', '_', s)
    s = re.sub(r'[^a-z0-9_]', '', s)
    s = re.sub(r'_+', '_', s).strip('_')
    return s

def esc(s):
    # Escape backslash then single quote for TS string literals
    return s.replace('\\', '\\\\').replace("'", "\\'")

def brand_title(b):
    return b.strip().title()

lines = []
lines.append("import { Machine, MachineWithGyms } from './types';")
lines.append("import { getMachineGymIds } from './gymMachines';")
lines.append('')
lines.append('const BASE_MACHINES: Machine[] = [')

count = 0
with open('data/machines_clean.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        mid    = to_id(row['machine code'])
        name   = esc(row['Machine_Name'].strip())
        brand  = esc(brand_title(row['Brand']))
        target = TARGET_MAP.get(row['TARGET_PART'].strip(), 'Other')
        cat    = esc(row['machine_category'].strip().title())
        cr     = row['copyright'].strip().lower()
        cval   = 'no' if cr in ('', 'no', '\uc544\ub2c8\uc624') else esc(row['copyright'].strip())
        lines.append(
            f"  {{ id: '{mid}', name: '{name}', brand: '{brand}', "
            f"targetMuscle: '{target}', category: '{cat}', exerciseKind: 'machine', copyright: '{cval}' }},"
        )
        count += 1

lines.append('];')
lines.append('')
lines.append('export const MACHINES: MachineWithGyms[] = BASE_MACHINES.map(machine => ({')
lines.append('  ...machine,')
lines.append('  gymIds: getMachineGymIds(machine.id),')
lines.append('}));')
lines.append('')

with open('src/data/machines.ts', 'w', encoding='utf-8') as out:
    out.write('\n'.join(lines))

print(f"Done - wrote {count} machine entries to src/data/machines.ts")
