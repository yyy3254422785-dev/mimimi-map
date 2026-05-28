import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEYS = {
  goal: "shiba-goal",
  bonePoints: "shiba-bone-points",
  checkedInDates: "shiba-checked-in-dates",
  tasksByDate: "shiba-tasks-by-date",
  posts: "shiba-posts",
};

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

  for (let i = -range; i <= range; i++) {
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

function App() {
  const todayKey = getDateKey(new Date());

  const [goalInput, setGoalInput] = useState("");

const [goal, setGoal] = useState(() => {
  return loadString(STORAGE_KEYS.goal, "Prepare for Finals");
});

const [bonePoints, setBonePoints] = useState(() => {
  return loadNumber(STORAGE_KEYS.bonePoints, 35);
});

const [checkedInDates, setCheckedInDates] = useState(() => {
  return loadJSON(STORAGE_KEYS.checkedInDates, []);
});

  const streak = useMemo(() => {
   return calculateCurrentStreak(checkedInDates, todayKey);
  }, [checkedInDates, todayKey]);

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [customDate, setCustomDate] = useState(todayKey);
  const [taskInput, setTaskInput] = useState("");

  const [tasksByDate, setTasksByDate] = useState(() => {
  return loadJSON(STORAGE_KEYS.tasksByDate, {
    [todayKey]: [
      {
        id: crypto.randomUUID(),
        text: "Review one lecture topic",
        done: false,
      },
      {
        id: crypto.randomUUID(),
        text: "Complete 3 practice questions",
        done: false,
      },
      {
        id: crypto.randomUUID(),
        text: "Write a 5-minute reflection",
        done: false,
      },
    ],
  });
});

  const [posts, setPosts] = useState(() => {
  return loadJSON(STORAGE_KEYS.posts, [
    {
      id: crypto.randomUUID(),
      name: "Mochi",
      text: "Checked in today! Our Dog Circle is getting stronger 🐶",
    },
    {
      id: crypto.randomUUID(),
      name: "Bao",
      text: "Almost skipped my task, but the streak reminder helped.",
    },
  ]);
});

  const visibleDates = useMemo(() => {
    return createDateRange(selectedDate, 3);
  }, [selectedDate]);

  const selectedTasks = tasksByDate[selectedDate] || [];
  const completedCount = selectedTasks.filter((task) => task.done).length;
  const totalCount = selectedTasks.length;
  const hasCheckedInToday = checkedInDates.includes(todayKey);

  useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.goal, goal);
}, [goal]);

useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.bonePoints, String(bonePoints));
}, [bonePoints]);

useEffect(() => {
  localStorage.setItem(
    STORAGE_KEYS.checkedInDates,
    JSON.stringify(checkedInDates)
  );
}, [checkedInDates]);

useEffect(() => {
  localStorage.setItem(
    STORAGE_KEYS.tasksByDate,
    JSON.stringify(tasksByDate)
  );
}, [tasksByDate]);

useEffect(() => {
  localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
}, [posts]);

  function createGoal() {
    const trimmedGoal = goalInput.trim();

    if (trimmedGoal === "") {
      return;
    }

    setGoal(trimmedGoal);

    const suggestedTasks = [
      {
        id: crypto.randomUUID(),
        text: `Break "${trimmedGoal}" into smaller steps`,
        done: false,
      },
      {
        id: crypto.randomUUID(),
        text: `Complete one small action for "${trimmedGoal}"`,
        done: false,
      },
      {
        id: crypto.randomUUID(),
        text: "Check in before the day ends",
        done: false,
      },
    ];

    setTasksByDate((current) => ({
      ...current,
      [selectedDate]: [...(current[selectedDate] || []), ...suggestedTasks],
    }));

    setGoalInput("");
  }

  function addTask() {
    const trimmedTask = taskInput.trim();

    if (trimmedTask === "") {
      return;
    }

    const newTask = {
      id: crypto.randomUUID(),
      text: trimmedTask,
      done: false,
    };

    setTasksByDate((current) => ({
      ...current,
      [selectedDate]: [...(current[selectedDate] || []), newTask],
    }));

    setTaskInput("");
  }

  function toggleTask(taskId) {
    setTasksByDate((current) => {
      const currentTasks = current[selectedDate] || [];

      const updatedTasks = currentTasks.map((task) => {
        if (task.id !== taskId) return task;

        if (!task.done) {
          setBonePoints((points) => points + 5);
        } else {
          setBonePoints((points) => Math.max(0, points - 5));
        }

        return {
          ...task,
          done: !task.done,
        };
      });

      return {
        ...current,
        [selectedDate]: updatedTasks,
      };
    });
  }

  function deleteTask(taskId) {
    setTasksByDate((current) => {
      const updatedTasks = (current[selectedDate] || []).filter(
        (task) => task.id !== taskId
      );

      return {
        ...current,
        [selectedDate]: updatedTasks,
      };
    });
  }

  function moveTaskToTomorrow(taskId) {
    const tomorrow = new Date(selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getDateKey(tomorrow);

    const taskToMove = selectedTasks.find((task) => task.id === taskId);

    if (!taskToMove) return;

    setTasksByDate((current) => {
      const currentDateTasks = (current[selectedDate] || []).filter(
        (task) => task.id !== taskId
      );

      const tomorrowTasks = current[tomorrowKey] || [];

      return {
        ...current,
        [selectedDate]: currentDateTasks,
        [tomorrowKey]: [
          ...tomorrowTasks,
          {
            ...taskToMove,
            id: crypto.randomUUID(),
            done: false,
          },
        ],
      };
    });
  }

  function completeDailyCheckIn() {
  if (selectedDate !== todayKey) {
    alert("You can only complete check-in for today.");
    return;
  }

  if (checkedInDates.includes(todayKey)) {
    alert("You have already checked in today.");
    return;
  }

  if (selectedTasks.length === 0) {
    alert("Add at least one task before checking in.");
    return;
  }

  const allDone = selectedTasks.every((task) => task.done);

  if (!allDone) {
    alert("Finish all today's tasks or move unfinished tasks to tomorrow.");
    return;
  }

  const updatedCheckedInDates = [...checkedInDates, todayKey];
  const newStreak = calculateCurrentStreak(updatedCheckedInDates, todayKey);

  setCheckedInDates(updatedCheckedInDates);
  setBonePoints((points) => points + 20);

  const newPost = {
    id: crypto.randomUUID(),
    name: "You",
    text: `Completed today's plan for "${goal}"! Current streak: ${newStreak} days 🦴`,
  };

  setPosts((currentPosts) => [newPost, ...currentPosts]);
  }

  
  function jumpToCustomDate() {
    setSelectedDate(customDate);
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="team">team mimimi</p>
          <h1>ShibaSteps 🐕</h1>
          <p>
            Turn big goals into date-based daily actions, then stay consistent
            with check-ins, streaks, and Dog Circle accountability.
          </p>
        </div>

        <div className="dog-card">
          <div className="dog-icon">🐶</div>
          <h2>Level 3 Shiba</h2>
          <p>{bonePoints} 🦴 Bone Points</p>
        </div>
      </header>

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
              placeholder="e.g. Prepare for finals"
            />
            <button onClick={createGoal}>Create</button>
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
              const taskCount = (tasksByDate[dateKey] || []).length;
              const doneCount = (tasksByDate[dateKey] || []).filter(
                (task) => task.done
              ).length;
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
                      checked={task.done}
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
    </div>
  );
}

export default App;