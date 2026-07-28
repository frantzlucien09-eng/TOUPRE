import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, code, new_password } = await req.json();
    if (!email || !code || !new_password) {
      return new Response(JSON.stringify({ error: "Manque paramèt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Modpas dwe gen omwen 6 karaktè" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: otpRecord, error: otpError } = await supabase
      .from("email_otp_codes")
      .select("id, used, expires_at")
      .eq("email", email)
      .eq("code", code)
      .eq("purpose", "password_reset")
      .eq("used", false)
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return new Response(JSON.stringify({ error: "Kòd la pa kòrèk oswa li ekspire." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Kòd la ekspire. Mand yon nouvo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      return new Response(JSON.stringify({ error: "Erè, eseye ankò" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = users.users.find((u) => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: "Pa gen kont ki konekte ak imèl sa a." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });
    if (updateError) {
      return new Response(JSON.stringify({ error: "Erè, eseye ankò" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("email_otp_codes").update({ used: true }).eq("id", otpRecord.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erè, eseye ankò" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
