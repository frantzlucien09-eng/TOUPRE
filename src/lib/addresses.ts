import { supabase } from './supabase';

export type SavedAddress = {
  id: string;
  user_id: string;
  label: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AddressInput = {
  label?: string | null;
  full_name?: string | null;
  phone?: string | null;
  address: string;
  city?: string | null;
  department?: string | null;
  is_default?: boolean;
};

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedAddress[];
}

export async function createAddress(userId: string, input: AddressInput): Promise<SavedAddress> {
  if (input.is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  }
  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      label: input.label ?? 'Kay',
      full_name: input.full_name ?? null,
      phone: input.phone ?? null,
      address: input.address,
      city: input.city ?? null,
      department: input.department ?? null,
      is_default: input.is_default ?? false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as SavedAddress;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: Partial<AddressInput>
): Promise<void> {
  if (input.is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  }
  const { error } = await supabase
    .from('addresses')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', addressId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', addressId)
    .eq('user_id', userId);
  if (error) throw error;
}
