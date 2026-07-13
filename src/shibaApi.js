const API_BASE = String(
  import.meta.env.VITE_API_BASE || "http://localhost:3001",
).replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`API ${response.status} at ${response.url}: ${text}`);
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
  return request(`/api/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
}
