const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";
const STATE_ROW_ID = 1;

const configuredOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requests from ESP32 and command-line tools usually have no Origin header.
      if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "100kb" }));

app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}]`,
    req.method,
    req.originalUrl,
    `Host: ${req.get("host")}`,
    `User-Agent: ${req.get("user-agent") || "unknown"}`,
  );
  res.setHeader("X-ShibaSteps-Server", "express-supabase");
  next();
});

const defaultState = {
  tasks: [],
  currentTaskId: null,
  timer: {
    selectedMinutes: 25,
    remainingSeconds: 25 * 60,
    status: "ready",
  },
  updatedAt: new Date().toISOString(),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultState() {
  return clone(defaultState);
}

function normalizeState(value) {
  const savedState = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

  return {
    ...createDefaultState(),
    ...savedState,
    tasks: Array.isArray(savedState.tasks) ? savedState.tasks : [],
    currentTaskId:
      typeof savedState.currentTaskId === "string"
        ? savedState.currentTaskId
        : null,
    timer: {
      ...defaultState.timer,
      ...(savedState.timer && typeof savedState.timer === "object"
        ? savedState.timer
        : {}),
    },
    updatedAt:
      typeof savedState.updatedAt === "string"
        ? savedState.updatedAt
        : new Date().toISOString(),
  };
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SECRET_KEY environment variables.",
    );
  }
}

function supabaseHeaders(extraHeaders = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  // New sb_secret_* keys belong only in the apikey header. Legacy
  // service_role JWT keys also need Authorization to bypass RLS.
  if (!SUPABASE_KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  return headers;
}

async function readStateFromSupabase() {
  assertSupabaseConfigured();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shiba_state?id=eq.${STATE_ROW_ID}&select=state`,
    {
      method: "GET",
      headers: supabaseHeaders(),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Supabase read failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const rows = text ? JSON.parse(text) : [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return normalizeState(rows[0].state);
}

async function writeStateToSupabase(nextState) {
  assertSupabaseConfigured();

  const stateToSave = normalizeState({
    ...nextState,
    updatedAt: new Date().toISOString(),
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shiba_state?on_conflict=id`,
    {
      method: "POST",
      headers: supabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify([
        {
          id: STATE_ROW_ID,
          state: stateToSave,
          updated_at: stateToSave.updatedAt,
        },
      ]),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Supabase write failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return stateToSave;
}

let state = createDefaultState();
let initializationError = null;
let writeQueue = Promise.resolve();

const initializationPromise = (async () => {
  const savedState = await readStateFromSupabase();

  if (savedState) {
    state = savedState;
    console.log("Loaded ShibaSteps state from Supabase.");
    return;
  }

  state = await writeStateToSupabase(createDefaultState());
  console.log("Created the initial ShibaSteps state in Supabase.");
})().catch((error) => {
  initializationError = error;
  console.error("Failed to initialize Supabase state:", error);
});

async function ensureStateReady(req, res, next) {
  await initializationPromise;

  if (initializationError) {
    return res.status(503).json({
      error: "Persistent storage is unavailable",
      details: initializationError.message,
    });
  }

  return next();
}

function updateState(mutator) {
  const operation = writeQueue.then(async () => {
    const draft = clone(state);
    const mutatedState = mutator(draft) || draft;
    const savedState = await writeStateToSupabase(mutatedState);
    state = savedState;
    return clone(state);
  });

  // Keep future writes running even if this specific operation fails.
  writeQueue = operation.catch(() => undefined);
  return operation;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/", (req, res) => {
  res.send("ShibaSteps API is running with Supabase persistence");
});

app.get(
  "/health",
  asyncRoute(async (req, res) => {
    await initializationPromise;

    if (initializationError) {
      return res.status(503).json({
        ok: false,
        service: "ShibaSteps API",
        storage: "unavailable",
        details: initializationError.message,
        time: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      service: "ShibaSteps API",
      storage: "supabase",
      time: new Date().toISOString(),
    });
  }),
);

app.use("/api", asyncRoute(ensureStateReady));

app.get("/api/state", (req, res) => {
  res.status(200).json(state);
});

app.patch(
  "/api/state",
  asyncRoute(async (req, res) => {
    const updates = req.body;

    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      return res.status(400).json({
        error: "Request body must be an object",
      });
    }

    const savedState = await updateState((draft) => ({
      ...draft,
      ...updates,
      timer: updates.timer
        ? {
            ...draft.timer,
            ...updates.timer,
          }
        : draft.timer,
    }));

    return res.status(200).json(savedState);
  }),
);

app.put(
  "/api/tasks",
  asyncRoute(async (req, res) => {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({
        error: "tasks must be an array",
      });
    }

    const sanitizedTasks = tasks.map((task, index) => ({
      id: String(task.id ?? `task-${index}`),
      text: String(task.text ?? ""),
      done: Boolean(task.done),
      goalId: task.goalId === undefined ? null : task.goalId,
    }));

    const savedState = await updateState((draft) => {
      draft.tasks = sanitizedTasks;

      const currentTaskStillExists = draft.tasks.some(
        (task) => task.id === draft.currentTaskId,
      );

      if (!currentTaskStillExists) {
        draft.currentTaskId = draft.tasks[0]?.id ?? null;
      }

      return draft;
    });

    return res.status(200).json(savedState);
  }),
);

app.patch(
  "/api/tasks/:taskId",
  asyncRoute(async (req, res) => {
    if (typeof req.body.done !== "boolean") {
      return res.status(400).json({
        error: "done must be a boolean",
      });
    }

    let updatedTask = null;

    const savedState = await updateState((draft) => {
      const task = draft.tasks.find((item) => item.id === req.params.taskId);

      if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        throw error;
      }

      task.done = req.body.done;
      updatedTask = clone(task);
      return draft;
    });

    console.log("Task updated:", updatedTask, "State:", savedState.updatedAt);
    return res.status(200).json(updatedTask);
  }),
);

app.patch(
  "/api/current-task",
  asyncRoute(async (req, res) => {
    const { currentTaskId } = req.body;

    if (typeof currentTaskId !== "string" || currentTaskId.length === 0) {
      return res.status(400).json({
        error: "currentTaskId must be a non-empty string",
      });
    }

    const savedState = await updateState((draft) => {
      const taskExists = draft.tasks.some((task) => task.id === currentTaskId);

      if (!taskExists) {
        const error = new Error("Invalid currentTaskId");
        error.statusCode = 400;
        throw error;
      }

      draft.currentTaskId = currentTaskId;
      return draft;
    });

    return res.status(200).json(savedState);
  }),
);

app.patch(
  "/api/timer",
  asyncRoute(async (req, res) => {
    const { selectedMinutes, remainingSeconds, status } = req.body;

    if (
      selectedMinutes !== undefined &&
      (!Number.isInteger(selectedMinutes) || selectedMinutes <= 0)
    ) {
      return res.status(400).json({
        error: "selectedMinutes must be a positive integer",
      });
    }

    if (
      remainingSeconds !== undefined &&
      (!Number.isInteger(remainingSeconds) || remainingSeconds < 0)
    ) {
      return res.status(400).json({
        error: "remainingSeconds must be a non-negative integer",
      });
    }

    const validStatuses = ["ready", "running", "paused", "finished"];
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid timer status",
      });
    }

    const savedState = await updateState((draft) => {
      if (selectedMinutes !== undefined) {
        draft.timer.selectedMinutes = selectedMinutes;
      }
      if (remainingSeconds !== undefined) {
        draft.timer.remainingSeconds = remainingSeconds;
      }
      if (status !== undefined) {
        draft.timer.status = status;
      }
      return draft;
    });

    return res.status(200).json(savedState.timer);
  }),
);

app.use((req, res) => {
  console.log("Express route not found:", req.method, req.originalUrl);
  return res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(error.statusCode || 500).json({
    error: error.message || "Internal server error",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ShibaSteps API running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}/api/state`);
});
