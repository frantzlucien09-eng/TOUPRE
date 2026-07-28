const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel project settings (Settings > Environment Variables).'
  );
}

const isDev = import.meta.env.DEV;

type OtpPurpose = 'signup' | 'email_change' | 'password_reset';

type SendOtpResult = { success: boolean; code?: string; error?: string };

export async function sendEmailOtp(email: string, purpose: OtpPurpose): Promise<SendOtpResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, purpose }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error ?? 'Erè, eseye ankò' };
    }
    const data = await res.json();
    return { success: true, code: data.code };
  } catch {
    return { success: false, error: 'Erè rezo, eseye ankò' };
  }
}

export async function verifyEmailOtp(
  email: string,
  code: string,
  purpose: OtpPurpose
): Promise<{ valid: boolean; error?: string }> {
  if (isDev) {
    return { valid: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, code, purpose }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { valid: false, error: data.error ?? 'Kòd la pa kòrèk oswa li ekspire.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Erè rezo, eseye ankò' };
  }
}

export async function resetPasswordViaOtp(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return { success: false, error: data.error ?? 'Erè, eseye ankò' };
    return { success: true };
  } catch {
    return { success: false, error: 'Erè rezo, eseye ankò' };
  }
}
