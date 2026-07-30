import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, code, purpose } = await req.json();
    if (!email || !code || !purpose) {
      return new Response(
        JSON.stringify({ error: "Email, code, ak purpose obligatwa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPurposes = ["signup", "email_change", "password_reset"];
    if (!validPurposes.includes(purpose)) {
      return new Response(
        JSON.stringify({ error: "Tip purpose la pa valid." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: otpRecord, error: otpError } = await supabase
      .from("email_otp_codes")
      .select("id, used, expires_at")
      .eq("email", email)
      .eq("code", code)
      .eq("purpose", purpose)
      .eq("used", false)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      return new Response(
        JSON.stringify({ error: `Erè baz done: ${otpError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "Kòd la pa kòrèk oswa li ekspire." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Kòd la ekspire. Mand yon nouvo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase
      .from("email_otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("[verify-email-otp] Failed to mark code as used:", updateError.message);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Kòd konfime." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erè, eseye ankò" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
