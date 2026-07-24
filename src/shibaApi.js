import { supabase } from "./supabaseClient"

const API_BASE = String(
  import.meta.env.VITE_API_BASE || "http://localhost:3001",
).replace(/\/+$/, "");

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Unable to read login session: ${error.message}`);
  }

  if (!session?.access_token) {
    throw new Error("You must be logged in before accessing ShibaSteps data.");
  }

  return session.access_token;
}

async function request(path, options = {}) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    let message = text;

    try {
      const body = text ? JSON.parse(text) : null;
      message = body?.error || body?.details || text;
    } catch {
      // Keep the original response text.
    }

    throw new Error(
      `API ${response.status} at ${response.url}: ${message}`,
    );
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `API returned non-JSON at ${response.url}: ${text.slice(0, 200)}`,
    );
  }
}

export function getSharedState() {
  return request("/api/state");
}

export function publishTodayTasks(tasks) {
  return request("/api/tasks", {
    method: "PUT",
    body: JSON.stringify({ tasks }),
  });
}

export function updateTaskOnServer(taskId, done) {
  return request(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
}