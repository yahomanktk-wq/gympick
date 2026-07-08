import { supabase } from '../supabase';
import { saveGymMachineIds } from './gymMachines';
import { invalidateGymsCache } from './gyms';

// 어드민이 직접 등록한 헬스장 (manager_id IS NULL)
export interface AdminGym {
  id:         string;
  name:       string;
  location:   string;
  phone:      string;
  hours:      string;
  hoursNote:  string;
  machineIds: string[];
  createdAt:  string;
}

// 직접등록 헬스장 목록 조회 (manager_id IS NULL + 보유 머신)
export async function fetchAdminGyms(): Promise<AdminGym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select(`
      id, name, location, phone, hours, hours_note, created_at,
      manager_id,
      gym_machines ( machine_id )
    `)
    .is('manager_id', null)
    .order('created_at', { ascending: false });

  if (error || !data) {
    if (__DEV__ && error) console.warn('[db/adminGyms] fetchAdminGyms error:', error.message);
    return [];
  }

  return data.map((row: any) => ({
    id:         row.id,
    name:       row.name,
    location:   row.location,
    phone:      row.phone ?? '',
    hours:      row.hours ?? '',
    hoursNote:  row.hours_note ?? '',
    machineIds: (row.gym_machines ?? []).map((gm: any) => gm.machine_id),
    createdAt:  row.created_at ?? '',
  }));
}

// 직접등록 (gyms insert + 머신 저장)
export async function insertAdminGym(
  name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[],
): Promise<{ error: string | null }> {
  try {
    const gymId = `g_${Date.now()}`;
    const { geocodeAddress } = await import('../geocoding');
    const coords = await geocodeAddress(location.trim());

    const { error: insertError } = await supabase.from('gyms').insert({
      id:          gymId,
      name:        name.trim(),
      location:    location.trim(),
      phone:       phone.trim(),
      hours:       hours.trim(),
      hours_note:  hoursNote.trim() || null,
      description: '',
      latitude:    coords?.latitude  ?? null,
      longitude:   coords?.longitude ?? null,
      manager_id:  null,
    });
    if (insertError) return { error: insertError.message };

    // 보유 머신 저장 (gym_machines)
    const { error: machineError } = await saveGymMachineIds(gymId, machineIds);
    if (machineError) return { error: machineError };

    invalidateGymsCache();
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '알 수 없는 오류' };
  }
}

// 직접등록 헬스장 수정 (gyms update + 머신 저장)
export async function updateAdminGymFull(
  id: string, name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[],
): Promise<{ error: string | null }> {
  try {
    const { geocodeAddress } = await import('../geocoding');
    const coords = await geocodeAddress(location.trim());

    const { error: updateError } = await supabase
      .from('gyms')
      .update({
        name:       name.trim(),
        location:   location.trim(),
        phone:      phone.trim(),
        hours:      hours.trim(),
        hours_note: hoursNote.trim() || null,
        latitude:   coords?.latitude  ?? null,
        longitude:  coords?.longitude ?? null,
      })
      .eq('id', id);
    if (updateError) return { error: updateError.message };

    // 보유 머신 갱신 (전체 교체)
    const { error: machineError } = await saveGymMachineIds(id, machineIds);
    if (machineError) return { error: machineError };

    invalidateGymsCache();
    return { error: null };
  } catch (e: any) {
    return { error: e.message ?? '알 수 없는 오류' };
  }
}
