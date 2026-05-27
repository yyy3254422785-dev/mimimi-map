import { useEffect, useMemo, useState } from "react";
import "./App.css";

function getDateKey(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateKey) {
  const date = new Date(dateKey);
  return date.toLocaleDateString("en-SG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDateLabel(dateKey) {
  const todayKey = getDateKey(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = getDateKey(tomorrow);

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  if (dateKey === tomorrowKey) return "Tomorrow";
  return formatDisplayDate(dateKey);
}

function createDateRange(centerDate, range = 3) {
  const dates = [];

  for (let i = -range; i <= range; i++) {
    const date = new Date(centerDate);
    date.setDate(centerDate.getDate() + i);
    dates.push(getDateKey(date));
  }

  return dates;
}

function App() {
  const todayKey = getDateKey(new Date());

  const [goalInput, setGoalInput] = useState("");
  const [goal, setGoal] = useState(() => {
    return localStorage.getItem("shiba-goal") || "Prepare for Finals";
  });

  const [bonePoints, setBonePoints] = useState(() => {
    return Number(localStorage.getItem("shiba-bone-points")) || 35;
  });

  const [streak, setStreak] = useState(() => {
    return Number(localStorage.getItem("shiba-streak")) || 4;
  });

  const [checkedInDates, setCheckedInDates] = useState(() => {
  const saved = localStorage.getItem("shiba-checked-in-dates");

  if (saved) {
    return JSON.parse(saved);
  }

  return [];
  });

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [customDate, setCustomDate] = useState(todayKey);
  const [taskInput, setTaskInput] = useState("");

  const [tasksByDate, setTasksByDate] = useState(() => {
    const saved = localStorage.getItem("shiba-tasks-by-date");

    if (saved) {
      return JSON.parse(saved);
    }

    return {
      [todayKey]: [
        { id: crypto.randomUUID(), text: "Review one lecture topic", done: false },
        { id: crypto.randomUUID(), text: "Complete 3 practice questions", done: false },
        { id: crypto.randomUUID(), text: "Write a 5-minute reflection", done: false },
      ],
    };
  });

  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem("shiba-posts");

    if (saved) {
      return JSON.parse(saved);
    }

    return [
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
    ];
  });

  const visibleDates = useMemo(() => {
    return createDateRange(new Date(selectedDate), 3);
  }, [selectedDate]);

  const selectedTasks = tasksByDate[selectedDate] || [];
  const completedCount = selectedTasks.filter((task) => task.done).length;
  const totalCount = selectedTasks.length;
  const hasCheckedInToday = checkedInDates.includes(todayKey);

  useEffect(() => {
    localStorage.setItem("shiba-goal", goal);
  }, [goal]);

  useEffect(() => {
  localStorage.setItem("shiba-checked-in-dates", JSON.stringify(checkedInDates));
  }, [checkedInDates]);
  
  useEffect(() => {
    localStorage.setItem("shiba-bone-points", String(bonePoints));
  }, [bonePoints]);

  useEffect(() => {
    localStorage.setItem("shiba-streak", String(streak));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem("shiba-tasks-by-date", JSON.stringify(tasksByDate));
  }, [tasksByDate]);

  useEffect(() => {
    localStorage.setItem("shiba-posts", JSON.stringify(posts));
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

    if (selectedTasks.length === 0) {
      alert("Add at least one task before checking in.");
      return;
    }

    const allDone = selectedTasks.every((task) => task.done);

    if (!allDone) {
      alert("Finish all today's tasks or move unfinished tasks to tomorrow.");
      return;
    }

    const newStreak = streak + 1;

    setStreak(newStreak);
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
                    {doneCount}/{taskCount} done
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

          <button className="checkin" onClick={completeDailyCheckIn}>
            Complete Daily Check-in
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