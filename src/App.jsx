import { useState } from "react";
import "./App.css";

function App() {
  const [goalInput, setGoalInput] = useState("");
  const [goal, setGoal] = useState("Prepare for Finals");
  const [streak, setStreak] = useState(4);
  const [poopXP, setPoopXP] = useState(35);

  const [tasks, setTasks] = useState([
    { text: "Review one lecture topic", done: false },
    { text: "Complete 3 practice questions", done: false },
    { text: "Write a 5-minute reflection", done: false },
  ]);

  const [posts, setPosts] = useState([
    {
      name: "Mochi",
      text: "Checked in today! Our Dog Circle is getting stronger 🐶",
    },
    {
      name: "Bao",
      text: "Almost skipped my task, but the streak reminder helped.",
    },
  ]);

  function createGoal() {
    if (goalInput.trim() === "") {
      return;
    }

    setGoal(goalInput);

    setTasks([
      { text: `Break "${goalInput}" into smaller steps`, done: false },
      { text: "Complete one simple task today", done: false },
      { text: "Check in before the day ends", done: false },
    ]);

    setGoalInput("");
  }

  function toggleTask(index) {
    const updatedTasks = [...tasks];
    const wasDone = updatedTasks[index].done;

    updatedTasks[index].done = !wasDone;
    setTasks(updatedTasks);

    if (!wasDone) {
      setPoopXP((currentXP) => currentXP + 5);
    } else {
      setPoopXP((currentXP) => Math.max(0, currentXP - 5));
    }
  }

  function checkIn() {
    const allDone = tasks.every((task) => task.done);

    if (!allDone) {
      alert("Finish all daily tasks before checking in!");
      return;
    }

    const newStreak = streak + 1;

    setStreak(newStreak);
    setPoopXP((currentXP) => currentXP + 20);

    const newPost = {
      name: "You",
      text: `Completed today's tasks for "${goal}"! Current streak: ${newStreak} days 💩`,
    };

    setPosts([newPost, ...posts]);
    setTasks(tasks.map((task) => ({ ...task, done: false })));
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="team">team mimimi</p>
          <h1>ShibaSteps 🐕</h1>
          <p>
            A Shiba-themed goal tracking app that turns big goals into small
            daily actions.
          </p>
        </div>

        <div className="dog-card">
          <div className="dog-icon">🐶</div>
          <h2>Level 3 Shiba</h2>
          <p>{poopXP} 💩 XP</p>
        </div>
      </header>

      <main className="layout">
        <section className="card">
          <h2>Create a Goal</h2>
          <p className="small-text">
            Enter a goal and ShibaSteps will generate simple daily tasks.
          </p>

          <div className="input-row">
            <input
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value)}
              placeholder="e.g. Build a workout habit"
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
              <strong>{poopXP}</strong>
              <span>poop XP</span>
            </div>
          </div>
        </section>

        <section className="card wide">
          <h2>Today's Tasks</h2>
          <p className="small-text">
            This MVP simulates task generation. In the future, this can become
            AI-powered.
          </p>

          <div className="tasks">
            {tasks.map((task, index) => (
              <label key={index} className={task.done ? "task done" : "task"}>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(index)}
                />
                {task.text}
              </label>
            ))}
          </div>

          <button className="checkin" onClick={checkIn}>
            Complete Daily Check-in
          </button>
        </section>

        <section className="card wide">
          <h2>Dog Circle 🐾</h2>
          <p className="small-text">
            20 users form a Dog Circle. Daily check-ins help the circle earn
            points and unlock decorations.
          </p>

          <div className="circle-score">
            <strong>Circle Points: {poopXP + streak * 10}</strong>
          </div>

          <div className="feed">
            {posts.map((post, index) => (
              <div className="post" key={index}>
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