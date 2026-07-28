import { supabase } from './supabase';

const BUCKET = 'product-media';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

async function compressImage(file: File, maxDim = 1280, quality = 0.78): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas unavailable'));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

export async function uploadProductPhoto(
  file: File,
  vendorId: string,
  productId: string
): Promise<string> {
  const compressed = await compressImage(file);
  if (compressed.size > MAX_PHOTO_BYTES) {
    throw new Error('Foto a twò gwo. Chwazi yon pi piti.');
  }
  const ext = 'jpg';
  const path = `${vendorId}/${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProductVideo(
  file: File,
  vendorId: string,
  productId: string
): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('Videyo a twò gwo. Maksimòm 25MB.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `${vendorId}/${productId}/video-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'video/mp4', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProductMedia(url: string): Promise<void> {
  try {
    const parts = url.split('/product-media/');
    if (parts.length < 2) return;
    const path = decodeURIComponent(parts[1]);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // best-effort
  }
}

const PROOF_BUCKET = 'delivery-proofs';

export async function uploadDeliveryProof(
  file: File,
  vendorId: string,
  orderId: string
): Promise<string> {
  const compressed = await compressImage(file, 1280, 0.72);
  if (compressed.size > MAX_PHOTO_BYTES) {
    throw new Error('Foto a twò gwo. Chwazi yon pi piti.');
  }
  const path = `${vendorId}/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
