import { supabase } from '../supabase';

export interface GymOfficialBrand {
  id:         string;
  gymId:      string;
  brand:      string;
  createdAt:  string;
}

export async function fetchGymOfficialBrands(gymId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('gym_official_brands')
      .select('brand')
      .eq('gym_id', gymId);
    return (data ?? []).map((r: { brand: string }) => r.brand);
  } catch {
    return [];
  }
}

export async function addGymOfficialBrand(gymId: string, brand: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('gym_official_brands')
      .insert({ gym_id: gymId, brand });
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function removeGymOfficialBrand(gymId: string, brand: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('gym_official_brands')
      .delete()
      .eq('gym_id', gymId)
      .eq('brand', brand);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function fetchAllGymOfficialBrands(): Promise<Record<string, string[]>> {
  try {
    const { data } = await supabase
      .from('gym_official_brands')
      .select('gym_id, brand');
    const result: Record<string, string[]> = {};
    (data ?? []).forEach((r: { gym_id: string; brand: string }) => {
      if (!result[r.gym_id]) result[r.gym_id] = [];
      result[r.gym_id].push(r.brand);
    });
    return result;
  } catch {
    return {};
  }
}
