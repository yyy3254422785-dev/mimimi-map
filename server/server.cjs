const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const stateFilePath = path.join(__dirname, "state.json");

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

function loadState() {
  try {
    if (!fs.existsSync(stateFilePath)) {
      return structuredClone(defaultState);
    }

    const fileContent = fs.readFileSync(stateFilePath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Failed to read state.json:", error);
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  state.updatedAt = new Date().toISOString();

  fs.writeFileSync(
    stateFilePath,
    JSON.stringify(state, null, 2),
    "utf8"
  );
}

// 检查服务器
app.get("/", (req, res) => {
  res.send("ShibaSteps API is running");
});

// React 和 ESP32 都可以获取完整状态
app.get("/api/state", (req, res) => {
  res.json(state);
});

// React 上传今天的任务
app.put("/api/tasks", (req, res) => {
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({
      error: "tasks must be an array",
    });
  }

  state.tasks = tasks.map((task, index) => ({
    id: String(task.id ?? `task-${index}`),
    text: String(task.text ?? ""),
    done: Boolean(task.done),
    goalId: task.goalId ?? null,
  }));

  const currentTaskStillExists = state.tasks.some(
    (task) => task.id === state.currentTaskId
  );

  if (!currentTaskStillExists) {
    state.currentTaskId = state.tasks[0]?.id ?? null;
  }

  saveState();
  res.json(state);
});

// 更新某个任务的完成状态
app.patch("/api/tasks/:taskId", (req, res) => {
  const task = state.tasks.find(
    (item) => item.id === req.params.taskId
  );

  if (!task) {
    return res.status(404).json({
      error: "Task not found",
    });
  }

  if (typeof req.body.done === "boolean") {
    task.done = req.body.done;
  }

  saveState();
  res.json(task);
});

// ESP32 更新当前选中的任务
app.patch("/api/current-task", (req, res) => {
  const { currentTaskId } = req.body;

  const taskExists = state.tasks.some(
    (task) => task.id === currentTaskId
  );

  if (!taskExists) {
    return res.status(400).json({
      error: "Invalid currentTaskId",
    });
  }

  state.currentTaskId = currentTaskId;

  saveState();
  res.json(state);
});

// ESP32 更新番茄钟
app.patch("/api/timer", (req, res) => {
  const {
    selectedMinutes,
    remainingSeconds,
    status,
  } = req.body;

  if (
    Number.isInteger(selectedMinutes) &&
    selectedMinutes > 0
  ) {
    state.timer.selectedMinutes = selectedMinutes;
  }

  if (
    Number.isInteger(remainingSeconds) &&
    remainingSeconds >= 0
  ) {
    state.timer.remainingSeconds = remainingSeconds;
  }

  const validStatuses = [
    "ready",
    "running",
    "paused",
    "finished",
  ];

  if (validStatuses.includes(status)) {
    state.timer.status = status;
  }

  saveState();
  res.json(state.timer);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ShibaSteps API running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}/api/state`);
});
