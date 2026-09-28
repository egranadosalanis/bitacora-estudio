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

// Único email autorizado a pedir un envío de prueba (ver `preview` más
// abajo) — mismo valor que OWNER_EMAIL en src/App.jsx.
const OWNER_EMAIL = "egranadosalanis@gmail.com";

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

// Colores y fuentes calcados de :root (modo oscuro) en src/App.jsx, para
// que el correo se sienta parte de la app y no una plantilla genérica.
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_STACK = "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace";

// Mismo SVG de "picos" que el fondo de landing/index.html (la sección
// bajo "Make it Clever"), recoloreado en azul claro / rosa / verde en
// vez de ámbar/morado/cian, para que no sea todo azul.
const BG_SVG_BASE64 =
  "PHN2ZyB2aWV3Qm94PSIwIDAgMTIwMCA1MjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgc2xpY2UiPgogIDxyZWN0IHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjUyMCIgZmlsbD0iIzBBMEYxQyIgLz4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYXJlYUJsdWUiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzhEQTNGMCIgc3RvcC1vcGFjaXR5PSIwLjY1IiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM4REEzRjAiIHN0b3Atb3BhY2l0eT0iMCIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImFyZWFQaW5rIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGRjhGQjMiIHN0b3Atb3BhY2l0eT0iMC42NSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkY4RkIzIiBzdG9wLW9wYWNpdHk9IjAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJhcmVhR3JlZW4iIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzNEREM4NCIgc3RvcC1vcGFjaXR5PSIwLjYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzNEREM4NCIgc3RvcC1vcGFjaXR5PSIwIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPGcgc3Ryb2tlPSIjRTdFQ0Y1IiBzdHJva2Utb3BhY2l0eT0iMC4wNyI+CiAgICA8bGluZSB4MT0iMCIgeTE9IjEyMCIgeDI9IjEyMDAiIHkyPSIxMjAiIC8+CiAgICA8bGluZSB4MT0iMCIgeTE9IjI0MCIgeDI9IjEyMDAiIHkyPSIyNDAiIC8+CiAgICA8bGluZSB4MT0iMCIgeTE9IjM2MCIgeDI9IjEyMDAiIHkyPSIzNjAiIC8+CiAgICA8bGluZSB4MT0iMCIgeTE9IjQ4MCIgeDI9IjEyMDAiIHkyPSI0ODAiIC8+CiAgPC9nPgogIDxwb2x5Z29uIGZpbGw9InVybCgjYXJlYVBpbmspIiBwb2ludHM9IjAsNTIwIDAsNDgwIDQwLDM4MCA4MCw0MjAgMTIwLDMyMCAxNjAsMjgwIDIwMCwzNDAgMjQwLDE4MCAyODAsMjIwIDMyMCwxNDAgMzYwLDI0MCA0MDAsMjAwIDQ0MCwzMDAgNDgwLDQ3MCA1MjAsNDg1IDU2MCw0NzggNjAwLDQ3MCA2NDAsNDgwIDY4MCw0NzUgNzIwLDQ3MCA3NjAsNDc4IDgwMCw0NzIgODQwLDQ2OCA4ODAsNDc0IDkyMCw0NzAgOTYwLDQ2NiAxMDAwLDQ3MiAxMDQwLDQ2OCAxMDgwLDQ3NCAxMTIwLDQ3MCAxMTYwLDQ2NiAxMjAwLDQ3MCAxMjAwLDUyMCIgLz4KICA8cG9seWdvbiBmaWxsPSJ1cmwoI2FyZWFHcmVlbikiIHBvaW50cz0iMCw1MjAgMCw1MDAgNDAsNDk4IDgwLDQ5OSAxMjAsNDk3IDE2MCw0OTggMjAwLDQ5OSAyNDAsNDk3IDI4MCw0OTggMzIwLDQ5OSAzNjAsNDk3IDQwMCw0OTUgNDQwLDQ2MCA0ODAsMzIwIDUyMCwzODAgNTYwLDI2MCA2MDAsMzQwIDY0MCwxODAgNjgwLDI0MCA3MjAsMzAwIDc2MCwyMjAgODAwLDM4MCA4NDAsNDcwIDg4MCw0OTAgOTIwLDQ5NSA5NjAsNDk4IDEwMDAsNDk3IDEwNDAsNDk5IDEwODAsNDk4IDExMjAsNDk3IDExNjAsNDk5IDEyMDAsNDk4IDEyMDAsNTIwIiAvPgogIDxwb2x5Z29uIGZpbGw9InVybCgjYXJlYUJsdWUpIiBwb2ludHM9IjAsNTIwIDAsNDk5IDQwLDQ5NyA4MCw0OTggMTIwLDQ5OSAxNjAsNDk3IDIwMCw0OTggMjQwLDQ5OSAyODAsNDk3IDMyMCw0OTggMzYwLDQ5OSA0MDAsNDk3IDQ0MCw0OTUgNDgwLDQ5MCA1MjAsNDgwIDU2MCw0NzAgNjAwLDQyMCA2NDAsMzgwIDY4MCwzMDAgNzIwLDM0MCA3NjAsMjAwIDgwMCwyNjAgODQwLDE0MCA4ODAsMTgwIDkyMCw4MCA5NjAsMTQwIDEwMDAsNjAgMTA0MCwxMjAgMTA4MCwxNjAgMTEyMCw5MCAxMTYwLDEzMCAxMjAwLDE1MCAxMjAwLDUyMCIgLz4KICA8cG9seWxpbmUgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOERBM0YwIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIKICAgIHBvaW50cz0iMCw0OTkgNDAsNDk3IDgwLDQ5OCAxMjAsNDk5IDE2MCw0OTcgMjAwLDQ5OCAyNDAsNDk5IDI4MCw0OTcgMzIwLDQ5OCAzNjAsNDk5IDQwMCw0OTcgNDQwLDQ5NSA0ODAsNDkwIDUyMCw0ODAgNTYwLDQ3MCA2MDAsNDIwIDY0MCwzODAgNjgwLDMwMCA3MjAsMzQwIDc2MCwyMDAgODAwLDI2MCA4NDAsMTQwIDg4MCwxODAgOTIwLDgwIDk2MCwxNDAgMTAwMCw2MCAxMDQwLDEyMCAxMDgwLDE2MCAxMTIwLDkwIDExNjAsMTMwIDEyMDAsMTUwIiAvPgo8L3N2Zz4K";

function emailBodies(email: string) {
  const text = `Tu plan Premium ya está activo.

Tranquilo/a: no se te ha cobrado nada. Por haberte unido a Clever este
curso 2026-2027 te hemos regalado el plan Premium.

Con Premium tienes acceso a:
  • Clasificación histórica: compara el esfuerzo (horas por crédito) entre
    todas tus asignaturas aprobadas, y comparte tu top con una foto.
  • Exportar a Excel: descarga el registro diario, el resumen y las
    gráficas de tu curso en un .xlsx.

Ya está activo en tu cuenta (${email}) — solo tienes que entrar en la app.

Si tienes cualquier duda, responde a este mismo correo.

— El equipo de Clever`;

  const html = `
  <div style="background-color:#0A0F1C; background-image: url('data:image/svg+xml;base64,${BG_SVG_BASE64}'); background-size: cover; background-position: center; padding: 32px 16px;">
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; background:rgba(18,26,43,0.86); border: 1px solid rgba(38,50,74,0.9); border-radius: 16px; padding: 28px 26px; color: #E7ECF5;">
      <div style="font-family: ${MONO_STACK}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #4FD8EA; margin-bottom: 10px;">Clever · Bitácora de vuelo</div>
      <h1 style="font-size: 21px; font-weight: 800; line-height: 1.3; margin: 0 0 14px;">Tu plan Premium ya está activo</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #E7ECF5; margin: 0 0 14px;">
        Tranquilo/a: no se te ha cobrado nada. Por haberte unido a <strong>Clever</strong> este
        curso <strong>2026-2027</strong> te hemos regalado el plan
        <strong style="color:#4FD8EA;">Premium</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px;">Con Premium tienes acceso a:</p>
      <ul style="padding-left: 18px; margin: 0 0 16px; font-size: 14px; line-height: 1.7; color: #E7ECF5;">
        <li><strong>Clasificación histórica:</strong> compara el esfuerzo (horas por crédito)
          entre todas tus asignaturas aprobadas, y comparte tu top con una foto.</li>
        <li><strong>Exportar a Excel:</strong> descarga el registro diario, el resumen y las
          gráficas de tu curso en un .xlsx.</li>
      </ul>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Ya está activo en tu cuenta (<span style="font-family:${MONO_STACK}; font-size: 13px;">${email}</span>)
        — solo tienes que entrar en la app.
      </p>
      <p style="color: #8291AC; font-size: 12.5px; margin: 0 0 18px;">Si tienes cualquier duda, responde a este mismo correo.</p>
      <div style="border-top: 1px solid #26324A; padding-top: 14px; font-size: 12px; color: #8291AC;">— El equipo de Clever</div>
    </div>
  </div>`;

  return { text, html };
}

/** Manda el correo de la promo a `to`. Lanza si falla — quien la llame
 * decide qué hacer con el error (a la concesión real no le importa; al
 * envío de prueba sí). */
async function sendGrantEmail(to: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Faltan los secretos GMAIL_USER / GMAIL_APP_PASSWORD.");
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  const { text, html } = emailBodies(to);
  await transporter.sendMail({
    from: `Clever <${GMAIL_USER}>`,
    to,
    subject: "Tu plan Premium ya está activo",
    text,
    html,
  });
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

  // Modo "preview": solo el dueño de la app puede pedirlo, manda el correo
  // solo a su propia cuenta y NO toca la base de datos (no concede premium
  // a nadie) — para poder revisar el diseño antes de que salga de verdad.
  let body: { preview?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Sin cuerpo (o no es JSON) — se sigue con el flujo normal.
  }
  if (body?.preview) {
    if ((user.email || "").toLowerCase() !== OWNER_EMAIL) {
      return jsonResponse({ error: "Solo el dueño de la app puede pedir un envío de prueba." }, 403);
    }
    try {
      await sendGrantEmail(user.email!);
      return jsonResponse({ preview: true, emailSent: true });
    } catch (e) {
      return jsonResponse({ preview: true, emailSent: false, error: String((e as Error)?.message || e) }, 500);
    }
  }

  // Interruptor de seguridad (misma tabla que maintenance_mode): empieza
  // apagado, así desplegar la función no manda nada a nadie todavía. Solo
  // se enciende a mano, con una fila en app_settings, cuando el dueño ya
  // ha revisado el correo (con el modo preview de arriba) y da el visto
  // bueno. Si la fila no existe todavía (antes de aplicar la migración
  // 012), se trata como apagado.
  const { data: promoSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "premium_promo_enabled")
    .single();
  if (!promoSetting?.value?.enabled) {
    return jsonResponse({ granted: false, reason: "promo_disabled" });
  }

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
  if (user.email) {
    try {
      await sendGrantEmail(user.email);
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
