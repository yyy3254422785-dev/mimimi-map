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

async function supabaseRest(
  req,
  path,
  {
    method = "GET",
    body,
    extraHeaders = {},
  } = {},
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      method,
      headers: userSupabaseHeaders(
        req.auth.accessToken,
        extraHeaders,
      ),
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(
      `Supabase request failed (${response.status}): ` +
        text.slice(0, 500),
    );

    error.statusCode =
      response.status >= 400 &&
      response.status < 500
        ? response.status
        : 500;

    throw error;
  }

  return text ? JSON.parse(text) : null;
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

/* --------------------------------------------------
 * User Profile
 * -------------------------------------------------- */

app.get(
  "/api/profile",
  asyncRoute(async (req, res) => {
    const userId = req.auth.user.id;

    const rows = await supabaseRest(
      req,
      "profiles" +
        `?id=eq.${encodeURIComponent(userId)}` +
        "&select=id,display_name",
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({
        error: "Profile not found",
      });
    }

    const profile = rows[0];

    return res.status(200).json({
      id: profile.id,
      displayName: profile.display_name,
    });
  }),
);

app.patch(
  "/api/profile",
  asyncRoute(async (req, res) => {
    const displayName =
      typeof req.body.displayName === "string"
        ? req.body.displayName.trim()
        : "";

    if (
      displayName.length < 1 ||
      displayName.length > 40
    ) {
      return res.status(400).json({
        error:
          "Display name must contain 1 to 40 characters",
      });
    }

    const userId = req.auth.user.id;

    const rows = await supabaseRest(
      req,
      "profiles" +
        `?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        extraHeaders: {
          Prefer: "return=representation",
        },
        body: {
          display_name: displayName,
        },
      },
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({
        error:
          "Profile not found or you cannot update it",
      });
    }

    const profile = rows[0];

    return res.status(200).json({
      id: profile.id,
      displayName: profile.display_name,
    });
  }),
);

/* --------------------------------------------------
 * Dog Circle
 * -------------------------------------------------- */

app.get(
  "/api/posts",
  asyncRoute(async (req, res) => {
    const posts = await supabaseRest(
      req,
      "posts" +
        "?select=" +
        "id,user_id,content,created_at," +
        "profile:profiles!posts_user_id_fkey(display_name)" +
        "&order=created_at.desc" +
        "&limit=100",
    );

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(200).json([]);
    }

    const postIds = posts
      .map((post) => post.id)
      .filter(Boolean);

    const likes = await supabaseRest(
      req,
      "post_likes" +
        "?select=post_id,user_id" +
        `&post_id=in.(${postIds.join(",")})`,
    );

    const likeCounts = new Map();
    const likedPostIds = new Set();

    if (Array.isArray(likes)) {
      likes.forEach((like) => {
        likeCounts.set(
          like.post_id,
          (likeCounts.get(like.post_id) || 0) + 1,
        );

        if (like.user_id === req.auth.user.id) {
          likedPostIds.add(like.post_id);
        }
      });
    }

    const result = posts.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.created_at,
      author: {
        id: post.user_id,
        displayName:
          post.profile?.display_name || "Shiba User",
      },
      likeCount: likeCounts.get(post.id) || 0,
      likedByMe: likedPostIds.has(post.id),
      canDelete:
        post.user_id === req.auth.user.id,
    }));

    return res.status(200).json(result);
  }),
);

app.post(
  "/api/posts",
  asyncRoute(async (req, res) => {
    const content =
      typeof req.body.content === "string"
        ? req.body.content.trim()
        : "";

    if (content.length === 0) {
      return res.status(400).json({
        error: "Post content cannot be empty",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        error:
          "Post content cannot exceed 500 characters",
      });
    }

    const rows = await supabaseRest(
      req,
      "posts",
      {
        method: "POST",
        extraHeaders: {
          Prefer: "return=representation",
        },
        body: [
          {
            user_id: req.auth.user.id,
            content,
          },
        ],
      },
    );

    const post = Array.isArray(rows)
      ? rows[0]
      : null;

    if (!post) {
      throw new Error(
        "Post was created but no row was returned",
      );
    }

    return res.status(201).json({
      id: post.id,
      content: post.content,
      createdAt: post.created_at,
      author: {
        id: req.auth.user.id,
      },
      likeCount: 0,
      likedByMe: false,
      canDelete: true,
    });
  }),
);

app.delete(
  "/api/posts/:postId",
  asyncRoute(async (req, res) => {
    const postId = req.params.postId;

    const rows = await supabaseRest(
      req,
      `posts?id=eq.${encodeURIComponent(postId)}`,
      {
        method: "DELETE",
        extraHeaders: {
          Prefer: "return=representation",
        },
      },
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({
        error:
          "Post not found or you do not own it",
      });
    }

    return res.status(200).json({
      deleted: true,
      id: postId,
    });
  }),
);

app.post(
  "/api/posts/:postId/likes",
  asyncRoute(async (req, res) => {
    const postId = req.params.postId;

    await supabaseRest(
      req,
      "post_likes" +
        "?on_conflict=post_id,user_id",
      {
        method: "POST",
        extraHeaders: {
          Prefer:
            "resolution=ignore-duplicates,return=minimal",
        },
        body: [
          {
            post_id: postId,
            user_id: req.auth.user.id,
          },
        ],
      },
    );

    return res.status(200).json({
      liked: true,
      postId,
    });
  }),
);

app.delete(
  "/api/posts/:postId/likes",
  asyncRoute(async (req, res) => {
    const postId = req.params.postId;
    const userId = req.auth.user.id;

    await supabaseRest(
      req,
      "post_likes" +
        `?post_id=eq.${encodeURIComponent(postId)}` +
        `&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
      },
    );

    return res.status(200).json({
      liked: false,
      postId,
    });
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