const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

const SUPABASE_URL = String(
  process.env.SUPABASE_URL || "",
).replace(/\/+$/, "");

const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || "";

const configuredOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        configuredOrigins.length === 0 ||
        configuredOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origin not allowed by CORS: ${origin}`),
      );
    },
  }),
);

app.use(express.json({ limit: "100kb" }));

app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}]`,
    req.method,
    req.originalUrl,
    `User-Agent: ${req.get("user-agent") || "unknown"}`,
  );

  res.setHeader("X-ShibaSteps-Server", "express-supabase-auth");
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
  const savedState =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  return {
    ...createDefaultState(),
    ...savedState,
    tasks: Array.isArray(savedState.tasks)
      ? savedState.tasks
      : [],
    currentTaskId:
      typeof savedState.currentTaskId === "string"
        ? savedState.currentTaskId
        : null,
    timer: {
      ...defaultState.timer,
      ...(savedState.timer &&
      typeof savedState.timer === "object"
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
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const error = new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY",
    );
    error.statusCode = 503;
    throw error;
  }
}

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function verifyAccessToken(accessToken) {
  assertSupabaseConfigured();

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const text = await response.text();

  if (!response.ok) {
    const error = new Error("Invalid or expired access token");
    error.statusCode = 401;
    error.details = text.slice(0, 300);
    throw error;
  }

  const user = text ? JSON.parse(text) : null;

  if (!user?.id) {
    const error = new Error(
      "Supabase did not return a valid user",
    );
    error.statusCode = 401;
    throw error;
  }

  return user;
}

async function requireAuth(req, res, next) {
  try {
    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const user = await verifyAccessToken(accessToken);

    req.auth = {
      accessToken,
      user,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function userSupabaseHeaders(accessToken, extraHeaders = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function readUserState(userId, accessToken) {
  assertSupabaseConfigured();

  const encodedUserId = encodeURIComponent(userId);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shiba_state` +
      `?user_id=eq.${encodedUserId}&select=state`,
    {
      method: "GET",
      headers: userSupabaseHeaders(accessToken),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase read failed (${response.status}): ` +
        text.slice(0, 500),
    );
  }

  const rows = text ? JSON.parse(text) : [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return normalizeState(rows[0].state);
}

async function writeUserState(
  userId,
  accessToken,
  nextState,
) {
  assertSupabaseConfigured();

  const stateToSave = normalizeState({
    ...nextState,
    updatedAt: new Date().toISOString(),
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shiba_state` +
      "?on_conflict=user_id",
    {
      method: "POST",
      headers: userSupabaseHeaders(accessToken, {
        Prefer:
          "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify([
        {
          user_id: userId,
          state: stateToSave,
          updated_at: stateToSave.updatedAt,
        },
      ]),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase write failed (${response.status}): ` +
        text.slice(0, 500),
    );
  }

  return stateToSave;
}

async function getOrCreateUserState(req) {
  const { user, accessToken } = req.auth;

  const savedState = await readUserState(
    user.id,
    accessToken,
  );

  if (savedState) {
    return savedState;
  }

  return writeUserState(
    user.id,
    accessToken,
    createDefaultState(),
  );
}

/*
 * Serialize writes separately for each user.
 * Account A never shares a queue or state object with account B.
 */
const userWriteQueues = new Map();

function updateUserState(req, mutator) {
  const { user, accessToken } = req.auth;
  const previousOperation =
    userWriteQueues.get(user.id) || Promise.resolve();

  const operation = previousOperation.then(async () => {
    const currentState = await getOrCreateUserState(req);
    const draft = clone(currentState);
    const mutatedState = mutator(draft) || draft;

    return writeUserState(
      user.id,
      accessToken,
      mutatedState,
    );
  });

  userWriteQueues.set(
    user.id,
    operation.catch(() => undefined),
  );

  return operation;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/* Public routes */

app.get("/", (req, res) => {
  res.send(
    "ShibaSteps API is running with authenticated Supabase persistence",
  );
});

app.get("/health", (req, res) => {
  const configured = Boolean(
    SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
  );

  return res.status(configured ? 200 : 503).json({
    ok: configured,
    service: "ShibaSteps API",
    storage: configured ? "supabase" : "unavailable",
    authentication: "required for /api routes",
    time: new Date().toISOString(),
  });
});

/* Every /api route below this point requires a valid user token. */

app.use("/api", requireAuth);

app.get(
  "/api/state",
  asyncRoute(async (req, res) => {
    const state = await getOrCreateUserState(req);
    return res.status(200).json(state);
  }),
);

app.patch(
  "/api/state",
  asyncRoute(async (req, res) => {
    const updates = req.body;

    if (
      !updates ||
      typeof updates !== "object" ||
      Array.isArray(updates)
    ) {
      return res.status(400).json({
        error: "Request body must be an object",
      });
    }

    const savedState = await updateUserState(
      req,
      (draft) => ({
        ...draft,
        ...updates,
        timer: updates.timer
          ? {
              ...draft.timer,
              ...updates.timer,
            }
          : draft.timer,
      }),
    );

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
      goalId:
        task.goalId === undefined ? null : task.goalId,
    }));

    const savedState = await updateUserState(
      req,
      (draft) => {
        draft.tasks = sanitizedTasks;

        const currentTaskStillExists =
          draft.tasks.some(
            (task) =>
              task.id === draft.currentTaskId,
          );

        if (!currentTaskStillExists) {
          draft.currentTaskId =
            draft.tasks[0]?.id ?? null;
        }

        return draft;
      },
    );

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

    await updateUserState(req, (draft) => {
      const task = draft.tasks.find(
        (item) => item.id === req.params.taskId,
      );

      if (!task) {
        const error = new Error("Task not found");
        error.statusCode = 404;
        throw error;
      }

      task.done = req.body.done;
      updatedTask = clone(task);

      return draft;
    });

    return res.status(200).json(updatedTask);
  }),
);

app.patch(
  "/api/current-task",
  asyncRoute(async (req, res) => {
    const { currentTaskId } = req.body;

    if (
      typeof currentTaskId !== "string" ||
      currentTaskId.length === 0
    ) {
      return res.status(400).json({
        error:
          "currentTaskId must be a non-empty string",
      });
    }

    const savedState = await updateUserState(
      req,
      (draft) => {
        const taskExists = draft.tasks.some(
          (task) => task.id === currentTaskId,
        );

        if (!taskExists) {
          const error = new Error(
            "Invalid currentTaskId",
          );
          error.statusCode = 400;
          throw error;
        }

        draft.currentTaskId = currentTaskId;
        return draft;
      },
    );

    return res.status(200).json(savedState);
  }),
);

app.patch(
  "/api/timer",
  asyncRoute(async (req, res) => {
    const {
      selectedMinutes,
      remainingSeconds,
      status,
    } = req.body;

    if (
      selectedMinutes !== undefined &&
      (!Number.isInteger(selectedMinutes) ||
        selectedMinutes <= 0)
    ) {
      return res.status(400).json({
        error:
          "selectedMinutes must be a positive integer",
      });
    }

    if (
      remainingSeconds !== undefined &&
      (!Number.isInteger(remainingSeconds) ||
        remainingSeconds < 0)
    ) {
      return res.status(400).json({
        error:
          "remainingSeconds must be a non-negative integer",
      });
    }

    const validStatuses = [
      "ready",
      "running",
      "paused",
      "finished",
    ];

    if (
      status !== undefined &&
      !validStatuses.includes(status)
    ) {
      return res.status(400).json({
        error: "Invalid timer status",
      });
    }

    const savedState = await updateUserState(
      req,
      (draft) => {
        if (selectedMinutes !== undefined) {
          draft.timer.selectedMinutes =
            selectedMinutes;
        }

        if (remainingSeconds !== undefined) {
          draft.timer.remainingSeconds =
            remainingSeconds;
        }

        if (status !== undefined) {
          draft.timer.status = status;
        }

        return draft;
      },
    );

    return res.status(200).json(savedState.timer);
  }),
);

app.use((req, res) => {
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

  const responseBody = {
    error: error.message || "Internal server error",
  };

  if (
    process.env.NODE_ENV !== "production" &&
    error.details
  ) {
    responseBody.details = error.details;
  }

  return res
    .status(error.statusCode || 500)
    .json(responseBody);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ShibaSteps API running on port ${PORT}`,
  );
  console.log(
    "Private API routes require a Supabase access token.",
  );
});