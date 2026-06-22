import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import "./App.css";
import { getSharedState, publishTodayTasks } from "./shibaApi";

const API_BASE =
  "https://sturdy-computing-machine-4jv7gjxjjx9rc5xwg-3001.app.github.dev";
const STORAGE_KEYS = {
  goal: "shiba-goal",
  goals: "shiba-goals",
  activeGoalId: "shiba-active-goal-id",
  bonePoints: "shiba-bone-points",
  checkedInDates: "shiba-checked-in-dates",
  tasksByDate: "shiba-tasks-by-date",
  posts: "shiba-posts",
  carryOverDismissedDate: "shiba-carry-over-dismissed-date",
};

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadString(key, fallbackValue) {
  const saved = localStorage.getItem(key);
  return saved === null ? fallbackValue : saved;
}

function loadNumber(key, fallbackValue) {
  const saved = localStorage.getItem(key);

  if (saved === null) {
    return fallbackValue;
  }

  const numberValue = Number(saved);
  return Number.isNaN(numberValue) ? fallbackValue : numberValue;
}

function loadJSON(key, fallbackValue) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallbackValue : JSON.parse(saved);
  } catch (error) {
    console.error(`Failed to load ${key} from localStorage`, error);
    return fallbackValue;
  }
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey, amount) {
  const date = getDateFromKey(dateKey);
  date.setDate(date.getDate() + amount);
  return getDateKey(date);
}

function formatDisplayDate(dateKey) {
  const date = getDateFromKey(dateKey);

  return date.toLocaleDateString("en-SG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDateLabel(dateKey) {
  const todayKey = getDateKey(new Date());
  const yesterdayKey = addDays(todayKey, -1);
  const tomorrowKey = addDays(todayKey, 1);

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  if (dateKey === tomorrowKey) return "Tomorrow";

  return formatDisplayDate(dateKey);
}

function createDateRange(centerDateKey, range = 3) {
  const dates = [];

  for (let i = -range; i <= range; i += 1) {
    dates.push(addDays(centerDateKey, i));
  }

  return dates;
}

function calculateCurrentStreak(checkedInDates, todayKey) {
  const checkedDateSet = new Set(checkedInDates);

  let currentDateKey = checkedDateSet.has(todayKey)
    ? todayKey
    : addDays(todayKey, -1);

  let streakCount = 0;

  while (checkedDateSet.has(currentDateKey)) {
    streakCount += 1;
    currentDateKey = addDays(currentDateKey, -1);
  }

  return streakCount;
}

function createDefaultTasks(goalId) {
  return [
    {
      id: createId(),
      goalId,
      text: "Review one lecture topic",
      done: false,
    },
    {
      id: createId(),
      goalId,
      text: "Complete 3 practice questions",
      done: false,
    },
    {
      id: createId(),
      goalId,
      text: "Write a 5-minute reflection",
      done: false,
    },
  ];
}

function formatTimer(totalSeconds = 0) {
  const safeTotal = Number.isFinite(Number(totalSeconds))
    ? Math.max(0, Math.floor(Number(totalSeconds)))
    : 0;

  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function App() {
  const todayKey = getDateKey(new Date());

  // --------------------------------------------------
  // State hooks: keep all hooks inside App and at top level
  // --------------------------------------------------

  const [deviceState, setDeviceState] = useState(null);
  const [taskSyncError, setTaskSyncError] = useState("");
  const [deviceSyncError, setDeviceSyncError] = useState("");
  const appliedDeviceCompletionIdsRef = useRef(new Set());
  const [goalInput, setGoalInput] = useState("");
  const [goals, setGoals] = useState(() => {
  const savedGoals = loadJSON(STORAGE_KEYS.goals, null);

    if (Array.isArray(savedGoals) && savedGoals.length > 0) {
      return savedGoals;
    }

    const savedGoalTitle = loadString(STORAGE_KEYS.goal, "Prepare for Finals");

    return [
      {
        id: createId(),
        title: savedGoalTitle,
      },
    ];
  });

  const [activeGoalId, setActiveGoalId] = useState(() => {
    return loadString(STORAGE_KEYS.activeGoalId, "");
  });

  const initialGoalId =
    goals.find((goalItem) => goalItem.id === activeGoalId)?.id ?? goals[0]?.id;

  const [tasksByDate, setTasksByDate] = useState(() => {
    const savedTasksByDate = loadJSON(STORAGE_KEYS.tasksByDate, null);

    if (
      savedTasksByDate &&
      typeof savedTasksByDate === "object" &&
      !Array.isArray(savedTasksByDate)
    ) {
      return savedTasksByDate;
    }

    return {
      [todayKey]: createDefaultTasks(initialGoalId),
    };
  });

  const [bonePoints, setBonePoints] = useState(() => {
    return loadNumber(STORAGE_KEYS.bonePoints, 35);
  });

  const [checkedInDates, setCheckedInDates] = useState(() => {
    const savedDates = loadJSON(STORAGE_KEYS.checkedInDates, []);
    return Array.isArray(savedDates) ? savedDates : [];
  });

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [customDate, setCustomDate] = useState(todayKey);
  const [taskInput, setTaskInput] = useState("");
  const [showCarryOverPrompt, setShowCarryOverPrompt] = useState(false);

  const [posts, setPosts] = useState(() => {
    const savedPosts = loadJSON(STORAGE_KEYS.posts, null);

    if (Array.isArray(savedPosts)) {
      return savedPosts;
    }

    return [
      {
        id: createId(),
        name: "Mochi",
        text: "Checked in today! Our Dog Circle is getting stronger 🐶",
      },
      {
        id: createId(),
        name: "Bao",
        text: "Almost skipped my task, but the streak reminder helped.",
      },
    ];
  });

  // --------------------------------------------------
  // Derived values
  // --------------------------------------------------

  const activeGoal =
    goals.find((goalItem) => goalItem.id === activeGoalId) ?? goals[0];

  const goal = activeGoal?.title ?? "Prepare for Finals";

  const todayTasks = useMemo(() => {
    const tasks = tasksByDate[todayKey];
    return Array.isArray(tasks) ? tasks : [];
  }, [tasksByDate, todayKey]);

  const selectedTasks = useMemo(() => {
    const tasks = tasksByDate[selectedDate];
    return Array.isArray(tasks) ? tasks : [];
  }, [tasksByDate, selectedDate]);

  const visibleDates = useMemo(() => {
    return createDateRange(selectedDate, 3);
  }, [selectedDate]);

  const streak = useMemo(() => {
    return calculateCurrentStreak(checkedInDates, todayKey);
  }, [checkedInDates, todayKey]);

  const goalProgressList = useMemo(() => {
    const allTasks = Object.values(tasksByDate).flatMap((tasks) => {
      return Array.isArray(tasks) ? tasks : [];
    });

    return goals.map((goalItem) => {
      const relatedTasks = allTasks.filter(
        (task) => task.goalId === goalItem.id,
      );

      const completedTasks = relatedTasks.filter((task) => task.done).length;
      const totalTasks = relatedTasks.length;
      const progressPercent =
        totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      return {
        ...goalItem,
        completed: completedTasks,
        total: totalTasks,
        progressPercent,
      };
    });
  }, [goals, tasksByDate]);

  const completedCount = selectedTasks.filter((task) => task.done).length;
  const totalCount = selectedTasks.length;
  const hasCheckedInToday = checkedInDates.includes(todayKey);

  const yesterdayKey = addDays(todayKey, -1);
  const yesterdayTasks = Array.isArray(tasksByDate[yesterdayKey])
    ? tasksByDate[yesterdayKey]
    : [];
  const yesterdayUnfinishedCount = yesterdayTasks.filter(
    (task) => !task.done,
  ).length;

  const deviceTasks = Array.isArray(deviceState?.tasks)
    ? deviceState.tasks
    : [];
  const currentDeviceTask = deviceTasks.find(
    (task) => task.id === deviceState?.currentTaskId,
  );
  const deviceTimer = deviceState?.timer ?? {};

  const syncError = taskSyncError || deviceSyncError;

  // --------------------------------------------------
  // Effects
  // --------------------------------------------------

  useEffect(() => {
    const fallbackGoalId = activeGoal?.id;

    if (!fallbackGoalId) {
      return;
    }

    setTasksByDate((current) => {
      let changed = false;

      const updatedTasksByDate = Object.fromEntries(
        Object.entries(current).map(([dateKey, tasks]) => {
          const safeTasks = Array.isArray(tasks) ? tasks : [];

          return [
            dateKey,
            safeTasks.map((task) => {
              if (task.goalId) {
                return task;
              }

              changed = true;

              return {
                ...task,
                goalId: fallbackGoalId,
              };
            }),
          ];
        }),
      );

      return changed ? updatedTasksByDate : current;
    });
  }, [activeGoal?.id]);

  useEffect(() => {
  const todayTasks = Array.isArray(tasksByDate[todayKey])
    ? tasksByDate[todayKey]
    : [];

  const syncTasksToBackend = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tasks: todayTasks.map((task) => ({
            id: task.id,
            text: task.text,
            done: Boolean(task.done),
            goalId: task.goalId ?? null,
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Failed to sync tasks:",
          response.status,
          errorText,
        );

        return;
      }

      const updatedState = await response.json();

      console.log("Tasks synced to backend:", updatedState);
    } catch (error) {
      console.error("Cannot connect to backend:", error);
    }
  };

  syncTasksToBackend();
}, [tasksByDate, todayKey]);

  useEffect(() => {
    let cancelled = false;

    const uploadTasks = async () => {
      try {
        await publishTodayTasks(
          todayTasks.map((task) => ({
            id: task.id,
            text: task.text,
            done: Boolean(task.done),
            goalId: task.goalId ?? null,
          })),
        );

        if (!cancelled) {
          setTaskSyncError("");
        }
      } catch (error) {
        console.error("Task sync failed:", error);

        if (!cancelled) {
          setTaskSyncError("Unable to sync today's tasks");
        }
      }
    };

    uploadTasks();

    return () => {
      cancelled = true;
    };
  }, [todayTasks]);

  useEffect(() => {
    let cancelled = false;

    const fetchDeviceState = async () => {
      try {
        const data = await getSharedState();

        if (!data || typeof data !== "object") {
          throw new Error("The API returned an invalid shared state.");
        }

        if (!cancelled) {
          setDeviceState(data);
          setDeviceSyncError("");
        }
      } catch (error) {
        console.error("Device state sync failed:", error);

        if (!cancelled) {
          setDeviceSyncError("Desktop assistant offline");
        }
      }
    };

    fetchDeviceState();

    const intervalId = window.setInterval(fetchDeviceState, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
  const remotelyCompletedTaskIds = new Set(
    deviceTasks
      .filter((task) => Boolean(task.done))
      .map((task) => task.id),
  );

  for (const processedTaskId of appliedDeviceCompletionIdsRef.current) {
    if (!remotelyCompletedTaskIds.has(processedTaskId)) {
      appliedDeviceCompletionIdsRef.current.delete(processedTaskId);
    }
  }

  todayTasks.forEach((task) => {
    if (task.done && remotelyCompletedTaskIds.has(task.id)) {
      appliedDeviceCompletionIdsRef.current.add(task.id);
    }
  });

  const newlyCompletedTaskIds = todayTasks
    .filter((task) => {
      return (
        !task.done &&
        remotelyCompletedTaskIds.has(task.id) &&
        !appliedDeviceCompletionIdsRef.current.has(task.id)
      );
    })
    .map((task) => task.id);

  if (newlyCompletedTaskIds.length === 0) {
    return;
  }

  newlyCompletedTaskIds.forEach((taskId) => {
    appliedDeviceCompletionIdsRef.current.add(taskId);
  });

  setTasksByDate((current) => {
    const currentTodayTasks = Array.isArray(current[todayKey])
      ? current[todayKey]
      : [];

    return {
      ...current,
      [todayKey]: currentTodayTasks.map((task) => {
        return newlyCompletedTaskIds.includes(task.id)
          ? {
              ...task,
              done: true,
            }
          : task;
      }),
    };
  });

  setBonePoints((points) => {
    return points + newlyCompletedTaskIds.length * 5;
  });
}, [deviceState?.tasks, deviceTasks, todayKey, todayTasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (!activeGoal?.id) {
      return;
    }

    localStorage.setItem(STORAGE_KEYS.activeGoalId, activeGoal.id);
    localStorage.setItem(STORAGE_KEYS.goal, goal);
  }, [activeGoal?.id, goal]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.bonePoints, String(bonePoints));
  }, [bonePoints]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.checkedInDates,
      JSON.stringify(checkedInDates),
    );
  }, [checkedInDates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tasksByDate, JSON.stringify(tasksByDate));
  }, [tasksByDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    const dismissedDate = localStorage.getItem(
      STORAGE_KEYS.carryOverDismissedDate,
    );

    setShowCarryOverPrompt(
      yesterdayUnfinishedCount > 0 && dismissedDate !== todayKey,
    );
  }, [yesterdayUnfinishedCount, todayKey]);

  // --------------------------------------------------
  // Event handlers
  // --------------------------------------------------

  function createGoal() {
    const trimmedGoal = goalInput.trim();

    if (trimmedGoal === "") {
      return;
    }

    const newGoal = {
      id: createId(),
      title: trimmedGoal,
    };

    const suggestedTasks = [
      {
        id: createId(),
        goalId: newGoal.id,
        text: `Break "${trimmedGoal}" into smaller steps`,
        done: false,
      },
      {
        id: createId(),
        goalId: newGoal.id,
        text: `Complete one small action for "${trimmedGoal}"`,
        done: false,
      },
      {
        id: createId(),
        goalId: newGoal.id,
        text: "Check in before the day ends",
        done: false,
      },
    ];

    setGoals((currentGoals) => [...currentGoals, newGoal]);
    setActiveGoalId(newGoal.id);
    setTasksByDate((current) => ({
      ...current,
      [selectedDate]: [
        ...(Array.isArray(current[selectedDate]) ? current[selectedDate] : []),
        ...suggestedTasks,
      ],
    }));
    setGoalInput("");
  }

  function addTask() {
    const trimmedTask = taskInput.trim();

    if (trimmedTask === "" || !activeGoal?.id) {
      return;
    }

    const newTask = {
      id: createId(),
      goalId: activeGoal.id,
      text: trimmedTask,
      done: false,
    };

    setTasksByDate((current) => ({
      ...current,
      [selectedDate]: [
        ...(Array.isArray(current[selectedDate]) ? current[selectedDate] : []),
        newTask,
      ],
    }));

    setTaskInput("");
  }

  function toggleTask(taskId) {
    const taskToToggle = selectedTasks.find((task) => task.id === taskId);

    if (!taskToToggle) {
      return;
    }

    setTasksByDate((current) => {
      const currentTasks = Array.isArray(current[selectedDate])
        ? current[selectedDate]
        : [];

      return {
        ...current,
        [selectedDate]: currentTasks.map((task) => {
          return task.id === taskId
            ? {
                ...task,
                done: !task.done,
              }
            : task;
        }),
      };
    });

    setBonePoints((points) => {
      return taskToToggle.done ? Math.max(0, points - 5) : points + 5;
    });
  }

  function deleteTask(taskId) {
    setTasksByDate((current) => {
      const currentTasks = Array.isArray(current[selectedDate])
        ? current[selectedDate]
        : [];

      return {
        ...current,
        [selectedDate]: currentTasks.filter((task) => task.id !== taskId),
      };
    });
  }

  function moveTaskToTomorrow(taskId) {
    const tomorrowKey = addDays(selectedDate, 1);
    const taskToMove = selectedTasks.find((task) => task.id === taskId);

    if (!taskToMove) {
      return;
    }

    setTasksByDate((current) => {
      const currentDateTasks = Array.isArray(current[selectedDate])
        ? current[selectedDate]
        : [];
      const tomorrowTasks = Array.isArray(current[tomorrowKey])
        ? current[tomorrowKey]
        : [];

      return {
        ...current,
        [selectedDate]: currentDateTasks.filter((task) => task.id !== taskId),
        [tomorrowKey]: [
          ...tomorrowTasks,
          {
            ...taskToMove,
            id: createId(),
            done: false,
          },
        ],
      };
    });
  }

  function completeDailyCheckIn() {
    if (selectedDate !== todayKey) {
      window.alert("You can only complete check-in for today.");
      return;
    }

    if (checkedInDates.includes(todayKey)) {
      window.alert("You have already checked in today.");
      return;
    }

    if (selectedTasks.length === 0) {
      window.alert("Add at least one task before checking in.");
      return;
    }

    const allDone = selectedTasks.every((task) => task.done);

    if (!allDone) {
      window.alert(
        "Finish all today's tasks or move unfinished tasks to tomorrow.",
      );
      return;
    }

    const updatedCheckedInDates = [...checkedInDates, todayKey];
    const newStreak = calculateCurrentStreak(updatedCheckedInDates, todayKey);

    setCheckedInDates(updatedCheckedInDates);
    setBonePoints((points) => points + 20);
    setPosts((currentPosts) => [
      {
        id: createId(),
        name: "You",
        text: `Completed today's plan for "${goal}"! Current streak: ${newStreak} days 🦴`,
      },
      ...currentPosts,
    ]);
  }

  function moveYesterdayTasksToToday() {
    setTasksByDate((current) => {
      const currentYesterdayTasks = Array.isArray(current[yesterdayKey])
        ? current[yesterdayKey]
        : [];
      const currentTodayTasks = Array.isArray(current[todayKey])
        ? current[todayKey]
        : [];

      const unfinishedYesterdayTasks = currentYesterdayTasks.filter(
        (task) => !task.done,
      );
      const remainingYesterdayTasks = currentYesterdayTasks.filter(
        (task) => task.done,
      );

      if (unfinishedYesterdayTasks.length === 0) {
        return current;
      }

      const carriedOverTasks = unfinishedYesterdayTasks.map((task) => ({
        ...task,
        id: createId(),
        done: false,
      }));

      return {
        ...current,
        [yesterdayKey]: remainingYesterdayTasks,
        [todayKey]: [...currentTodayTasks, ...carriedOverTasks],
      };
    });

    localStorage.setItem(STORAGE_KEYS.carryOverDismissedDate, todayKey);
    setSelectedDate(todayKey);
    setCustomDate(todayKey);
    setShowCarryOverPrompt(false);
  }

  function dismissCarryOverPrompt() {
    localStorage.setItem(STORAGE_KEYS.carryOverDismissedDate, todayKey);
    setShowCarryOverPrompt(false);
  }

  function jumpToCustomDate() {
    if (!customDate) {
      return;
    }

    setSelectedDate(customDate);
  }

  return (
    <motion.div
      className="app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <AnimatePresence>
        {showCarryOverPrompt && (
          <motion.div
            className="carryover-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="carryover-modal"
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ duration: 0.25 }}
            >
              <div className="dog-icon">🐶</div>
              <h2>Move unfinished tasks?</h2>
              <p>
                You have {yesterdayUnfinishedCount} unfinished task
                {yesterdayUnfinishedCount > 1 ? "s" : ""} from yesterday.
              </p>
              <p className="small-text">
                Do you want to move them to today's plan?
              </p>

              <div className="carryover-actions">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={moveYesterdayTasksToToday}
                >
                  Move to Today
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="secondary-button"
                  onClick={dismissCarryOverPrompt}
                >
                  Not Now
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.header
        className="hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div>
          <p className="team">team mimimi</p>
          <h1>ShibaSteps 🐕</h1>
          <p>
            Turn big goals into date-based daily actions, then stay consistent
            with check-ins, streaks, and Dog Circle accountability.
          </p>
        </div>

        <motion.div
          className="dog-card"
          whileHover={{ y: -6, rotate: 1.5 }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="dog-icon">🐶</div>
          <h2>Level 3 Shiba</h2>
          <p>{bonePoints} 🦴 Bone Points</p>
        </motion.div>
      </motion.header>

      <main className="layout">
        <section className="card">
          <h2>Create a Goal</h2>
          <p className="small-text">
            Enter a long-term goal. ShibaSteps will add suggested tasks to your
            selected date.
          </p>

          <div className="input-row">
            <input
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  createGoal();
                }
              }}
              placeholder="e.g. Prepare for finals"
            />
            <button onClick={createGoal}>Create</button>
          </div>
        </section>

        <section className="card wide">
          <h2>Long-term Goals</h2>
          <p className="small-text">
            All long-term goals are listed here. Click a goal to make it the
            active goal for new tasks.
          </p>

          <div className="goal-list">
            {goalProgressList.map((goalItem) => (
              <button
                key={goalItem.id}
                className={
                  goalItem.id === activeGoal?.id
                    ? "goal-card active"
                    : "goal-card"
                }
                onClick={() => setActiveGoalId(goalItem.id)}
              >
                <div className="goal-card-top">
                  <strong>{goalItem.title}</strong>
                  <span>
                    {goalItem.completed}/{goalItem.total} small tasks completed
                  </span>
                </div>

                <div className="goal-progress-bar">
                  <div
                    style={{
                      width: `${goalItem.progressPercent}%`,
                    }}
                  />
                </div>

                <small>{goalItem.progressPercent}% complete</small>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Current Goal</h2>
          <h3>{goal}</h3>

          <div className="stats">
            <div>
              <strong>{streak}</strong>
              <span>day streak</span>
            </div>
            <div>
              <strong>{bonePoints}</strong>
              <span>bone points</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Desktop Assistant</h2>

          {syncError && <p className="error-text">{syncError}</p>}

          {!deviceState ? (
            <p>Connecting...</p>
          ) : (
            <>
              <p>
                Current task:{" "}
                <strong>{currentDeviceTask?.text ?? "No task selected"}</strong>
              </p>

              <p>
                Pomodoro:{" "}
                <strong>{formatTimer(deviceTimer.remainingSeconds)}</strong>
              </p>

              <p>
                Status: <strong>{deviceTimer.status ?? "unknown"}</strong>
              </p>
            </>
          )}
        </section>

        <section className="card wide">
          <h2>Date Planner</h2>
          <p className="small-text">
            Select any date to view, add, complete, or postpone tasks.
          </p>

          <div className="date-jump">
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
            />
            <button onClick={jumpToCustomDate}>Go to Date</button>
          </div>

          <div className="calendar-row">
            {visibleDates.map((dateKey) => {
              const dateTasks = Array.isArray(tasksByDate[dateKey])
                ? tasksByDate[dateKey]
                : [];
              const taskCount = dateTasks.length;
              const doneCount = dateTasks.filter((task) => task.done).length;
              const isCheckedIn = checkedInDates.includes(dateKey);

              return (
                <button
                  key={dateKey}
                  className={
                    dateKey === selectedDate ? "date-card active" : "date-card"
                  }
                  onClick={() => {
                    setSelectedDate(dateKey);
                    setCustomDate(dateKey);
                  }}
                >
                  <span>{getDateLabel(dateKey)}</span>
                  <strong>{formatDisplayDate(dateKey)}</strong>
                  <small>
                    {doneCount}/{taskCount} done {isCheckedIn ? "🐾" : ""}
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card wide">
          <div className="section-title-row">
            <div>
              <h2>{getDateLabel(selectedDate)}'s Tasks</h2>
              <p className="small-text">
                Selected date: <strong>{selectedDate}</strong>
              </p>
            </div>

            <div className="progress-pill">
              {completedCount}/{totalCount} completed
            </div>
          </div>

          <div className="input-row">
            <input
              value={taskInput}
              onChange={(event) => setTaskInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addTask();
                }
              }}
              placeholder="Add a plan for this date"
            />
            <button onClick={addTask}>Add Task</button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks for this date yet.</p>
              <p>Add one task above to start planning.</p>
            </div>
          ) : (
            <div className="tasks">
              {selectedTasks.map((task) => (
                <div key={task.id} className={task.done ? "task done" : "task"}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(task.done)}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span>{task.text}</span>
                  </label>

                  <div className="task-actions">
                    {!task.done && (
                      <button
                        className="secondary-button"
                        onClick={() => moveTaskToTomorrow(task.id)}
                      >
                        Move to Tomorrow
                      </button>
                    )}

                    <button
                      className="danger-button"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="checkin"
            onClick={completeDailyCheckIn}
            disabled={selectedDate === todayKey && hasCheckedInToday}
          >
            {selectedDate === todayKey && hasCheckedInToday
              ? "Checked in Today"
              : "Complete Daily Check-in"}
          </button>
        </section>

        <section className="card wide">
          <h2>Dog Circle 🐾</h2>
          <p className="small-text">
            This is still a simulated Dog Circle feed. It demonstrates social
            accountability before adding a real backend.
          </p>

          <div className="circle-score">
            <strong>Circle Points: {bonePoints + streak * 10}</strong>
          </div>

          <div className="feed">
            {posts.map((post) => (
              <div className="post" key={post.id}>
                <strong>{post.name}</strong>
                <p>{post.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </motion.div>
  );
}

export default App;
