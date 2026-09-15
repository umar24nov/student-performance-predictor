const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function getToken() {
  try { return localStorage.getItem("academicai_token"); } catch { return null; }
}
export function getUser() {
  try {
    const u = localStorage.getItem("academicai_user");
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}
export function saveAuth(token, user) {
  localStorage.setItem("academicai_token", token);
  localStorage.setItem("academicai_user", JSON.stringify(user));
}
export function clearAuth() {
  localStorage.removeItem("academicai_token");
  localStorage.removeItem("academicai_user");
}

export async function apiFetch(path, { method = "GET", body, auth = false, headers = {} } = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  const token = getToken();
  if (auth && token) opts.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (data && data.detail) || `Error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export default API_URL;