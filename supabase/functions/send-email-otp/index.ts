import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Use a verified sender domain if configured, otherwise fall back to Resend's
// shared testing address (works without domain verification).
const SENDER_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const SUBJECTS: Record<string, string> = {
  signup: "Kòd Konfimasyon TOUPRE",
  email_change: "Kòd Konfimasyon TOUPRE — Chanjman Imèl",
  password_reset: "Kòd pou Reyajiste Modpas TOUPRE",
};

const BODY_TEMPLATES: Record<string, (code: string) => string> = {
  signup: (c) => `Byenveni sou TOUPRE!\n\nKòd konfimasyon ou a se: ${c}\n\nKòd sa a valab pou 10 minit. Pa pataje l ak pèsonn.`,
  email_change: (c) => `Ou mande pou chanje imèl ou sou TOUPRE.\n\nKòd konfimasyon ou a se: ${c}\n\nKòd sa a valab pou 10 minit. Si pa w menm ki fè demand sa a, inyore imèl sa a.`,
  password_reset: (c) => `Ou mande pou reyajiste modpas ou sou TOUPRE.\n\nKòd ou a se: ${c}\n\nKòd sa a valab pou 10 minit. Si pa w menm ki fè demand sa a, inyore imèl sa a.`,
};

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3000];

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sendEmailViaResend(to: string, subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY pa konfigire. Ajoute l nan Supabase Edge Function secrets.");
  }

  let lastError = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to,
          subject,
          text: body,
        }),
      });

      if (res.ok) return;

      const errorBody = await res.text();
      lastError = `Resend API error (${res.status}): ${errorBody}`;

      if (!isRetryable(res.status)) {
        throw new Error(lastError);
      }

      console.warn(`[send-email-otp] Attempt ${attempt + 1} failed (retryable): ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Erè rezo";
      if (err instanceof TypeError) {
        console.warn(`[send-email-otp] Attempt ${attempt + 1} network error: ${lastError}`);
      } else {
        throw err;
      }
    }

    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }

  throw new Error(`Imèl pa t voye aprè ${MAX_RETRIES} esè: ${lastError}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, purpose } = await req.json();
    if (!email || !purpose) {
      return new Response(JSON.stringify({ error: "Email and purpose required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validPurposes = ["signup", "email_change", "password_reset"];
    if (!validPurposes.includes(purpose)) {
      return new Response(JSON.stringify({ error: "Invalid purpose" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 5 codes per email per 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("email_otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", fifteenMinAgo);

    if ((count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Twòp kòd mande. Tann 15 minit anvan w eseye ankò." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("email_otp_codes")
      .insert({ email, code, purpose, expires_at: expiresAt, used: false });

    if (insertError) {
      return new Response(JSON.stringify({ error: `Erè baz done: ${insertError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-email-otp] OTP for ${email} (${purpose}): ${code}`);

    // Send the email via Resend
    try {
      await sendEmailViaResend(email, SUBJECTS[purpose], BODY_TEMPLATES[purpose](code));
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : "Erè, eseye ankò";
      console.error(`[send-email-otp] Failed to send email to ${email}:`, msg);
      return new Response(
        JSON.stringify({ error: `Imèl pa t voye: ${msg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDev = Deno.env.get("DENO_DEPLOYMENT_ID") === undefined;
    const responseBody: Record<string, unknown> = {
      success: true,
      message: `Kòd voye bay ${email}`,
    };
    if (isDev) {
      responseBody.code = code;
    }

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erè, eseye ankò" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
