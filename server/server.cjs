const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 打印所有进入 Express 的请求
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}]`,
    req.method,
    req.originalUrl,
    `Host: ${req.get("host")}`,
    `User-Agent: ${req.get("user-agent") || "unknown"}`,
  );

  // 用来确认响应确实来自你的 Express
  res.setHeader(
    "X-ShibaSteps-Server",
    "express-3001",
  );

  next();
});

const stateFilePath = path.join(
  __dirname,
  "state.json",
);

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

function createDefaultState() {
  return JSON.parse(
    JSON.stringify(defaultState),
  );
}

function loadState() {
  try {
    if (!fs.existsSync(stateFilePath)) {
      return createDefaultState();
    }

    const fileContent = fs.readFileSync(
      stateFilePath,
      "utf8",
    );

    const savedState = JSON.parse(fileContent);

    return {
      ...createDefaultState(),
      ...savedState,

      timer: {
        ...defaultState.timer,
        ...(savedState.timer || {}),
      },

      tasks: Array.isArray(savedState.tasks)
        ? savedState.tasks
        : [],
    };
  } catch (error) {
    console.error(
      "Failed to read state.json:",
      error,
    );

    return createDefaultState();
  }
}

let state = loadState();

function saveState() {
  try {
    state.updatedAt =
      new Date().toISOString();

    fs.writeFileSync(
      stateFilePath,
      JSON.stringify(state, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error(
      "Failed to save state.json:",
      error,
    );
  }
}

// ==================================================
// 检查服务器
// ==================================================

app.get("/", (req, res) => {
  res.send("ShibaSteps API is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "ShibaSteps API",
    time: new Date().toISOString(),
  });
});

// ==================================================
// 获取完整共享状态
// ==================================================

app.get("/api/state", (req, res) => {
  res.status(200).json(state);
});

// 可选：更新部分共享状态
app.patch("/api/state", (req, res) => {
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

  state = {
    ...state,
    ...updates,

    timer: updates.timer
      ? {
          ...state.timer,
          ...updates.timer,
        }
      : state.timer,
  };

  saveState();

  console.log("State updated:", state);

  return res.status(200).json(state);
});

// ==================================================
// React 上传今天的任务
// ==================================================

app.put("/api/tasks", (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({
      error: "tasks must be an array",
    });
  }

  state.tasks = tasks.map(
    (task, index) => ({
      id: String(
        task.id ?? `task-${index}`,
      ),

      text: String(task.text ?? ""),

      done: Boolean(task.done),

      goalId:
        task.goalId === undefined
          ? null
          : task.goalId,
    }),
  );

  const currentTaskStillExists =
    state.tasks.some(
      (task) =>
        task.id === state.currentTaskId,
    );

  if (!currentTaskStillExists) {
    state.currentTaskId =
      state.tasks[0]?.id ?? null;
  }

  saveState();

  return res.status(200).json(state);
});

// ==================================================
// 更新某个任务的完成状态
// ==================================================

app.patch(
  "/api/tasks/:taskId",
  (req, res) => {
    const task = state.tasks.find(
      (item) =>
        item.id === req.params.taskId,
    );

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    if (
      typeof req.body.done !== "boolean"
    ) {
      return res.status(400).json({
        error: "done must be a boolean",
      });
    }

    task.done = req.body.done;

    saveState();

    console.log(
      "Task updated:",
      task,
    );

    return res.status(200).json(task);
  },
);

// ==================================================
// ESP32 更新当前选中的任务
// ==================================================

app.patch(
  "/api/current-task",
  (req, res) => {
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

    const taskExists = state.tasks.some(
      (task) =>
        task.id === currentTaskId,
    );

    if (!taskExists) {
      return res.status(400).json({
        error: "Invalid currentTaskId",
      });
    }

    state.currentTaskId =
      currentTaskId;

    saveState();

    return res.status(200).json(state);
  },
);

// ==================================================
// ESP32 更新番茄钟
// ==================================================

app.patch("/api/timer", (req, res) => {
  const {
    selectedMinutes,
    remainingSeconds,
    status,
  } = req.body;

  if (
    selectedMinutes !== undefined &&
    (
      !Number.isInteger(selectedMinutes) ||
      selectedMinutes <= 0
    )
  ) {
    return res.status(400).json({
      error:
        "selectedMinutes must be a positive integer",
    });
  }

  if (
    remainingSeconds !== undefined &&
    (
      !Number.isInteger(remainingSeconds) ||
      remainingSeconds < 0
    )
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

  if (selectedMinutes !== undefined) {
    state.timer.selectedMinutes =
      selectedMinutes;
  }

  if (remainingSeconds !== undefined) {
    state.timer.remainingSeconds =
      remainingSeconds;
  }

  if (status !== undefined) {
    state.timer.status = status;
  }

  saveState();

  return res
    .status(200)
    .json(state.timer);
});

// ==================================================
// 明确记录所有未匹配路由
// ==================================================

app.use((req, res) => {
  console.log(
    "Express route not found:",
    req.method,
    req.originalUrl,
  );

  return res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

// ==================================================
// 启动服务器
// ==================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `ShibaSteps API running on port ${PORT}`,
    );

    console.log(
      `Local: http://localhost:${PORT}/api/state`,
    );
  },
);