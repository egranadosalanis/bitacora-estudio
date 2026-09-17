import { getAdminClient } from "./adminClient.js";

// Verifica que la petición trae una sesión válida de Supabase Auth y que el
// email de esa sesión es el del creador (ADMIN_EMAIL). Cualquier otra cuenta,
// aunque haya iniciado sesión correctamente, recibe 403.
export async function requireAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const err = new Error("Falta el token de autenticación.");
    err.status = 401;
    throw err;
  }

  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error("Sesión inválida o caducada.");
    err.status = 401;
    throw err;
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const userEmail = (data.user.email || "").toLowerCase().trim();
  if (!adminEmail || userEmail !== adminEmail) {
    const err = new Error("No autorizado.");
    err.status = 403;
    throw err;
  }

  return data.user;
}
