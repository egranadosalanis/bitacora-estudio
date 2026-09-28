// ============================================================
// Edge Function: grant-premium
//
// Promoción "premium por unirte este curso" — cualquiera que inicie
// sesión antes de PROMO_CUTOFF recibe el plan premium (una sola vez)
// y un correo avisándole, mandado por Gmail real (SMTP) desde la
// cuenta de la app.
//
// La llama el cliente (src/AuthGate.jsx) con su propio JWT en cuanto
// carga el perfil. Es idempotente: si el usuario ya es premium (por
// esta promo o por cualquier otro motivo), no hace nada — así no
// importa cuántas veces se llame (cada inicio de sesión, recargas...).
//
// Variables de entorno necesarias (`supabase secrets set`):
//   GMAIL_USER            — la cuenta de Gmail remitente (ej. cleverapp2026@gmail.com)
//   GMAIL_APP_PASSWORD    — contraseña de aplicación de esa cuenta de Google
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase solas.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

// Última fecha (exclusiva, UTC) en la que un inicio de sesión todavía
// concede la promo. "Hasta julio de 2027" -> deja de conceder en agosto.
const PROMO_CUTOFF = Date.parse("2027-08-01T00:00:00Z");

const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function emailBodies(email: string) {
  const text = `¡Hola!

Por haberte unido a Clever este curso 2026-2027, te hemos activado el plan
Premium gratis — sin que tengas que hacer nada ni pagar nada.

Con Premium tienes acceso a:
  • Clasificación histórica: compara el esfuerzo (horas por crédito) entre
    todas tus asignaturas aprobadas, y comparte tu top con una foto.
  • Exportar a Excel: descarga el registro diario, el resumen y las
    gráficas de tu curso en un .xlsx.

Ya está activo en tu cuenta (${email}) — solo tienes que entrar en la app.

Si tienes cualquier duda, responde a este mismo correo.

— El equipo de Clever`;

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1b2333;">
    <p style="font-size: 16px;">¡Hola! 👋</p>
    <p>
      Por haberte unido a <strong>Clever</strong> este curso <strong>2026-2027</strong>,
      te hemos activado el plan <strong style="color:#0E8FA6;">Premium gratis</strong> —
      sin que tengas que hacer nada ni pagar nada.
    </p>
    <p>Con Premium tienes acceso a:</p>
    <ul style="padding-left: 18px; line-height: 1.6;">
      <li><strong>Clasificación histórica:</strong> compara el esfuerzo (horas por crédito)
        entre todas tus asignaturas aprobadas, y comparte tu top con una foto.</li>
      <li><strong>Exportar a Excel:</strong> descarga el registro diario, el resumen y las
        gráficas de tu curso en un .xlsx.</li>
    </ul>
    <p>Ya está activo en tu cuenta (<strong>${email}</strong>) — solo tienes que entrar en la app.</p>
    <p style="color: #5B6472; font-size: 13px;">Si tienes cualquier duda, responde a este mismo correo.</p>
    <p>— El equipo de Clever</p>
  </div>`;

  return { text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return jsonResponse({ error: "Falta el token de autenticación." }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return jsonResponse({ error: "Sesión inválida o caducada." }, 401);
  const user = userData.user;

  if (Date.now() >= PROMO_CUTOFF) {
    return jsonResponse({ granted: false, reason: "promo_ended" });
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("plan, premium_promo_granted_at")
    .eq("id", user.id)
    .single();
  if (profileErr) return jsonResponse({ error: profileErr.message }, 500);

  // Ya premium (por esta promo o por cualquier otro motivo): no tocar nada
  // ni reenviar el correo. Esto hace que llamar a esta función en cada
  // inicio de sesión sea seguro y barato.
  if (profile.plan !== "free" || profile.premium_promo_granted_at) {
    return jsonResponse({ granted: false, reason: "already_premium" });
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ plan: "premium_historico", premium_promo_granted_at: new Date().toISOString() })
    .eq("id", user.id);
  if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

  let emailSent = false;
  let emailError: string | null = null;
  if (user.email && GMAIL_USER && GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      });
      const { text, html } = emailBodies(user.email);
      await transporter.sendMail({
        from: `Clever <${GMAIL_USER}>`,
        to: user.email,
        subject: "🎉 Tienes Clever Premium gratis este curso",
        text,
        html,
      });
      emailSent = true;
    } catch (e) {
      // El premio ya se concedió aunque falle el correo — no se deshace:
      // el fallo de envío no debe dejar a nadie sin su premium.
      emailError = String((e as Error)?.message || e);
      console.error("No se pudo enviar el correo de premium:", emailError);
    }
  }

  return jsonResponse({ granted: true, emailSent, emailError });
});
