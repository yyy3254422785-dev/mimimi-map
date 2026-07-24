import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import "./App.css";
import {
  createPost,
  deletePost,
  getPosts,
  getProfile,
  getSharedState,
  likePost,
  publishTodayTasks,
  unlikePost,
  updatePrivateState,
  updateProfile,
} from "./shibaApi";
import { supabase } from "./supabaseClient";
import heroImage from "./assets/shiba-hero.png";


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

const LEGACY_MIGRATION_OWNER_KEY =
  "shiba-legacy-migration-owner";

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

  const date = getDateFromKey(dateKey);
  return date.toLocaleDateString("en-SG", {
    weekday: "short",
  });
}

function formatDateValue(dateKey) {
  const date = getDateFromKey(dateKey);
  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });
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

function createCleanPrivateData(todayKey) {
  const firstGoal = {
    id: createId(),
    title: "My First Goal",
  };

  return {
    schemaVersion: 1,
    goals: [firstGoal],
    activeGoalId: firstGoal.id,
    tasksByDate: {
      [todayKey]: [],
    },
    bonePoints: 0,
    checkedInDates: [],
    carryOverDismissedDate: "",
  };
}

function normalizePrivateData(value, todayKey) {
  const clean = createCleanPrivateData(todayKey);

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return clean;
  }

  const goals =
    Array.isArray(value.goals) && value.goals.length > 0
      ? value.goals
      : clean.goals;

  const activeGoalId = goals.some(
    (goal) => goal.id === value.activeGoalId,
  )
    ? value.activeGoalId
    : goals[0].id;

  return {
    schemaVersion: 1,
    goals,
    activeGoalId,
    tasksByDate:
      value.tasksByDate &&
      typeof value.tasksByDate === "object" &&
      !Array.isArray(value.tasksByDate)
        ? value.tasksByDate
        : clean.tasksByDate,
    bonePoints:
      typeof value.bonePoints === "number"
        ? value.bonePoints
        : clean.bonePoints,
    checkedInDates: Array.isArray(value.checkedInDates)
      ? value.checkedInDates
      : clean.checkedInDates,
    carryOverDismissedDate:
      typeof value.carryOverDismissedDate === "string"
        ? value.carryOverDismissedDate
        : "",
  };
}



function App() {
  const todayKey = getDateKey(new Date());

  // --------------------------------------------------
  // State hooks: keep all hooks inside App and at top level
  // --------------------------------------------------
  const [privateStateLoaded, setPrivateStateLoaded] = useState(false);
  const [privateStateError, setPrivateStateError] = useState("");
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

  const [
  carryOverDismissedDate,
  setCarryOverDismissedDate,
] = useState(() => {
  return loadString(
    STORAGE_KEYS.carryOverDismissedDate,
    "",
  );
});
const [displayName, setDisplayName] = useState("");
const [profileLoading, setProfileLoading] =
  useState(true);
const [profileSaving, setProfileSaving] =
  useState(false);
const [profileError, setProfileError] =
 useState("");
const [posts, setPosts] = useState([]);
const [postInput, setPostInput] = useState("");
const [postsLoading, setPostsLoading] =
  useState(true);
const [postsError, setPostsError] = useState("");
const [postSubmitting, setPostSubmitting] =
  useState(false);
const [pendingPostIds, setPendingPostIds] =
  useState(() => new Set());
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

  const isSelectedDateLocked = checkedInDates.includes(selectedDate);

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

  const activeGoalProgress =
    goalProgressList.find((g) => g.id === activeGoal?.id)?.progressPercent ?? 0;

  const shibaMessage = posts?.[0]?.content ?? "Ready for a walk!";

  // --------------------------------------------------
// Effects
// --------------------------------------------------
useEffect(() => {
  let cancelled = false;

  async function loadPrivateState() {
    try {
      setPrivateStateError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user?.id) {
        throw new Error("No authenticated user session found.");
      }

      const remoteState = await getSharedState();
      let nextPrivateData;

      if (
        remoteState?.appData?.schemaVersion === 1
      ) {
        nextPrivateData = normalizePrivateData(
          remoteState.appData,
          todayKey,
        );
      } else {
        const migrationOwner = localStorage.getItem(
          LEGACY_MIGRATION_OWNER_KEY,
        );

        if (
          !migrationOwner ||
          migrationOwner === session.user.id
        ) {
          nextPrivateData = normalizePrivateData(
            {
              schemaVersion: 1,
              goals,
              activeGoalId:
                activeGoal?.id ?? goals[0]?.id,
              tasksByDate,
              bonePoints,
              checkedInDates,
              carryOverDismissedDate,
            },
            todayKey,
          );

          await updatePrivateState({
            appData: nextPrivateData,
          });

          localStorage.setItem(
            LEGACY_MIGRATION_OWNER_KEY,
            session.user.id,
          );
        } else {
          nextPrivateData =
            createCleanPrivateData(todayKey);

          await updatePrivateState({
            appData: nextPrivateData,
          });
        }
      }

      if (cancelled) {
        return;
      }

      setGoals(nextPrivateData.goals);
      setActiveGoalId(nextPrivateData.activeGoalId);
      setTasksByDate(nextPrivateData.tasksByDate);
      setBonePoints(nextPrivateData.bonePoints);
      setCheckedInDates(
        nextPrivateData.checkedInDates,
      );
      setCarryOverDismissedDate(
        nextPrivateData.carryOverDismissedDate,
      );

      setPrivateStateLoaded(true);
    } catch (error) {
      console.error(
        "Failed to load private state:",
        error,
      );

      if (!cancelled) {
        setPrivateStateError(
          error.message ||
            "Unable to load your private data.",
        );
        setPrivateStateLoaded(true);
      }
    }
  }

  loadPrivateState();

  return () => {
    cancelled = true;
  };

  // This effect intentionally runs once for each App mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  if (!privateStateLoaded || privateStateError) {
    return undefined;
  }

  let cancelled = false;

  async function loadProfile() {
    try {
      setProfileLoading(true);
      setProfileError("");

      const profile = await getProfile();

      if (
        !profile ||
        typeof profile.displayName !== "string"
      ) {
        throw new Error(
          "The profile API returned invalid data.",
        );
      }

      if (!cancelled) {
        setDisplayName(profile.displayName);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);

      if (!cancelled) {
        setProfileError(
          error.message || "Unable to load profile.",
        );
      }
    } finally {
      if (!cancelled) {
        setProfileLoading(false);
      }
    }
  }

  loadProfile();

  return () => {
    cancelled = true;
  };
}, [privateStateLoaded, privateStateError]);

useEffect(() => {
  if (!privateStateLoaded || privateStateError) {
    return undefined;
  }

  const timeoutId = window.setTimeout(() => {
    updatePrivateState({
      appData: {
        schemaVersion: 1,
        goals,
        activeGoalId:
          activeGoal?.id ?? goals[0]?.id ?? "",
        tasksByDate,
        bonePoints,
        checkedInDates,
        carryOverDismissedDate,
      },
    }).catch((error) => {
      console.error(
        "Failed to save private state:",
        error,
      );
      setPrivateStateError(
        "Unable to save your latest changes.",
      );
    });
  }, 500);

  return () => {
    window.clearTimeout(timeoutId);
  };
}, [
  privateStateLoaded,
  privateStateError,
  goals,
  activeGoal?.id,
  tasksByDate,
  bonePoints,
  checkedInDates,
  carryOverDismissedDate,
]);

useEffect(() => {
  if (!privateStateLoaded || privateStateError) {
    return undefined;
  }

  let cancelled = false;

  async function loadPosts() {
    try {
      setPostsLoading(true);
      setPostsError("");

      const data = await getPosts();

      if (!Array.isArray(data)) {
        throw new Error(
          "The community API returned invalid data.",
        );
      }

      if (!cancelled) {
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to load posts:", error);

      if (!cancelled) {
        setPostsError(
          error.message ||
            "Unable to load Dog Circle.",
        );
      }
    } finally {
      if (!cancelled) {
        setPostsLoading(false);
      }
    }
  }

  loadPosts();

  return () => {
    cancelled = true;
  };
}, [privateStateLoaded, privateStateError]);

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
     if (!privateStateLoaded) {
    return undefined;}

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
  }, [todayTasks, privateStateLoaded]);

  useEffect(() => {
    if (!privateStateLoaded) {
    return undefined;}

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
  }, [privateStateLoaded]);

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
  setShowCarryOverPrompt(
    yesterdayUnfinishedCount > 0 &&
      !hasCheckedInToday &&
      carryOverDismissedDate !== todayKey,
  );
}, [
  yesterdayUnfinishedCount,
  todayKey,
  hasCheckedInToday,
  carryOverDismissedDate,
]);

  // --------------------------------------------------
  // Event handlers
  // --------------------------------------------------
async function handleUpdateProfile(event) {
  event.preventDefault();

  const trimmedDisplayName = displayName.trim();

  if (
    trimmedDisplayName.length < 1 ||
    trimmedDisplayName.length > 40
  ) {
    setProfileError(
      "Display name must contain 1 to 40 characters.",
    );
    return;
  }

  try {
    setProfileSaving(true);
    setProfileError("");

    const updatedProfile = await updateProfile(
      trimmedDisplayName,
    );

    setDisplayName(updatedProfile.displayName);

    // Refresh posts so the updated author name is
    // immediately visible in Dog Circle.
    await refreshPosts();
  } catch (error) {
    console.error("Failed to update profile:", error);

    setProfileError(
      error.message || "Unable to update profile.",
    );
  } finally {
    setProfileSaving(false);
  }
}

  async function refreshPosts() {
  const data = await getPosts();

  if (!Array.isArray(data)) {
    throw new Error(
      "The community API returned invalid data.",
    );
  }

  setPosts(data);
}

async function handleCreatePost(event) {
  event.preventDefault();

  const content = postInput.trim();

  if (!content) {
    return;
  }

  if (content.length > 500) {
    setPostsError(
      "Posts cannot exceed 500 characters.",
    );
    return;
  }

  try {
    setPostSubmitting(true);
    setPostsError("");

    await createPost(content);
    setPostInput("");
    await refreshPosts();
  } catch (error) {
    console.error("Failed to create post:", error);
    setPostsError(
      error.message || "Unable to publish this post.",
    );
  } finally {
    setPostSubmitting(false);
  }
}

function setPostPending(postId, pending) {
  setPendingPostIds((current) => {
    const next = new Set(current);

    if (pending) {
      next.add(postId);
    } else {
      next.delete(postId);
    }

    return next;
  });
}

async function handleToggleLike(post) {
  if (pendingPostIds.has(post.id)) {
    return;
  }

  try {
    setPostPending(post.id, true);
    setPostsError("");

    if (post.likedByMe) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }

    await refreshPosts();
  } catch (error) {
    console.error("Failed to update like:", error);
    setPostsError(
      error.message || "Unable to update this like.",
    );
  } finally {
    setPostPending(post.id, false);
  }
}

async function handleDeletePost(postId) {
  if (pendingPostIds.has(postId)) {
    return;
  }

  const confirmed = window.confirm(
    "Delete this post permanently?",
  );

  if (!confirmed) {
    return;
  }

  try {
    setPostPending(postId, true);
    setPostsError("");

    await deletePost(postId);
    await refreshPosts();
  } catch (error) {
    console.error("Failed to delete post:", error);
    setPostsError(
      error.message || "Unable to delete this post.",
    );
  } finally {
    setPostPending(postId, false);
  }
}

  function stopIfSelectedDateLocked() {
  if (!isSelectedDateLocked) {
    return false;
  }

  window.alert(
    "This day's tasks are locked because check-in is already complete.",
  );

  return true;
}

  function createGoal() {
  if (stopIfSelectedDateLocked()) {
    return;
  }

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
      ...(Array.isArray(current[selectedDate])
        ? current[selectedDate]
        : []),
      ...suggestedTasks,
    ],
  }));

  setGoalInput("");
}

  function addTask() {
  if (stopIfSelectedDateLocked()) {
    return;
  }

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
      ...(Array.isArray(current[selectedDate])
        ? current[selectedDate]
        : []),
      newTask,
    ],
  }));

  setTaskInput("");
}

  function toggleTask(taskId) {
  if (stopIfSelectedDateLocked()) {
    return;
  }

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
  if (stopIfSelectedDateLocked()) {
    return;
  }

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
  if (stopIfSelectedDateLocked()) {
    return;
  }

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

    const updatedCheckedInDates = [
    ...checkedInDates,
    todayKey,
  ];

setCheckedInDates(updatedCheckedInDates);
    setBonePoints((points) => points + 20);
  }

  function moveYesterdayTasksToToday() {
  if (hasCheckedInToday) {
    setShowCarryOverPrompt(false);

    window.alert(
      "Today's tasks are locked because check-in is already complete.",
    );

    return;
  }

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

    setCarryOverDismissedDate(todayKey);
    setCustomDate(todayKey);
    setShowCarryOverPrompt(false);
  }

  function dismissCarryOverPrompt() {
    setCarryOverDismissedDate(todayKey);
    setShowCarryOverPrompt(false);
  }

  function jumpToCustomDate() {
    if (!customDate) {
      return;
    }

    setSelectedDate(customDate);
  }

  if (privateStateError) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-dog">🐕</div>
        <h2>Unable to load ShibaSteps</h2>
        <p className="auth-error" role="alert">
          {privateStateError}
        </p>
        <button
          type="button"
          className="auth-submit"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    </main>
  );
}

if (!privateStateLoaded) {
  return (
    <main className="auth-page">
      <section className="auth-card auth-loading">
        <div className="auth-dog">🐕</div>
        <p>Loading your private ShibaSteps data...</p>
      </section>
    </main>
  );
}

  return (
    <motion.div
      className="app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="container">
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

      <motion.section
        className="redesigned-hero"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="hero-scene glass-lg">
          <div className="hero-scene-inner">
            <div className="hero-left">
              <div className="shiba-wrapper">
                <img src={heroImage} alt="Shiba" className="hero-shiba-image" />

                <div className="shiba-speech glass-sm">
                  <span className="speech-text">{shibaMessage}</span>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <div className="hero-info glass-md">
                <div className="hero-info-top">
                  <h3 className="hero-name">{activeGoal?.title ?? goal}</h3>
                  <div className="hero-level">Lv. {Math.max(1, Math.floor(bonePoints / 20) || 1)}</div>
                </div>

                <div className="hero-stats-row">
                  <div className="stat-item">
                    <div className="stat-value">{bonePoints}</div>
                    <div className="stat-label">Bone Points</div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-value">{streak}</div>
                    <div className="stat-label">Day Streak</div>
                  </div>
                </div>

                <div className="hero-progress">
                  <div className="progress-label">Progress</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${activeGoalProgress}%` }} />
                  </div>
                  <div className="progress-percent">{activeGoalProgress}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <main className="dashboard-layout">
        <div className="dashboard-column-left">
          {/* Date Planner (primary) */}
          <section className="card wide glass-lg">
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
                    <strong>{formatDateValue(dateKey)}</strong>
                    <small>
                      {doneCount}/{taskCount} done {isCheckedIn ? "🐾" : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tasks / Daily Mission (primary) */}
          <section className="card wide glass-lg">
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

            {isSelectedDateLocked && (
  <div className="locked-notice">
    🔒 Check-in completed. Tasks for this date are now locked.
  </div>
)}

            <div className="input-row">
              <input
  value={taskInput}
  onChange={(event) => setTaskInput(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === "Enter") {
      addTask();
    }
  }}
  placeholder={
    isSelectedDateLocked
      ? "Tasks are locked after check-in"
      : "Add a plan for this date"
  }
  disabled={isSelectedDateLocked}
/>

<button
  onClick={addTask}
  disabled={isSelectedDateLocked}
>
  Add Task
</button>
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
  disabled={isSelectedDateLocked}
/>
                      <span>{task.text}</span>
                    </label>

                    {!isSelectedDateLocked && (
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
)}
                  </div>
                ))}
              </div>
            )}

            <button
  className="checkin"
  onClick={completeDailyCheckIn}
  disabled={selectedDate !== todayKey || isSelectedDateLocked}
>
  {isSelectedDateLocked
    ? "Checked In — Tasks Locked"
    : selectedDate !== todayKey
      ? "Check-in Available Today Only"
      : "Complete Daily Check-in"}
</button>
          </section>
        </div>

        <aside className="dashboard-column-right">
          {/* Profile */}
<section className="profile-card glass-sm">
  <div className="section-label">Your Profile</div>

  {profileLoading ? (
    <p className="small-text">
      Loading profile...
    </p>
  ) : (
    <form
      className="profile-form"
      onSubmit={handleUpdateProfile}
    >
      <label htmlFor="profile-display-name">
        Display name
      </label>

      <input
        id="profile-display-name"
        type="text"
        value={displayName}
        onChange={(event) =>
          setDisplayName(event.target.value)
        }
        minLength={1}
        maxLength={40}
        autoComplete="nickname"
        disabled={profileSaving}
      />

      <div className="profile-form-footer">
        <span>{displayName.length}/40</span>

        <button
          type="submit"
          disabled={
            profileSaving ||
            displayName.trim().length === 0
          }
        >
          {profileSaving ? "Saving..." : "Save Name"}
        </button>
      </div>
    </form>
  )}

  {profileError && (
    <p className="error-text" role="alert">
      {profileError}
    </p>
  )}
</section>
          {/* Compact Create Goal (secondary small) */}
          <section className="create-section glass-sm">
            <div className="section-label">Create Goal</div>
            <div className="input-row compact">
              <input
  value={goalInput}
  onChange={(event) => setGoalInput(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === "Enter") {
      createGoal();
    }
  }}
  placeholder={
    isSelectedDateLocked
      ? "Select an unlocked date first"
      : "New goal"
  }
  disabled={isSelectedDateLocked}
/>

<button
  onClick={createGoal}
  disabled={isSelectedDateLocked}
>
  Create
</button>
            </div>
          </section>

          {/* Goal Garden (medium) */}
          <section className="goals-sidebar glass-md">
            <h2>Long-term Goals</h2>
            <p className="small-text">
              Click a goal to make it the active goal for new tasks.
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

          {/* Current Goal / Stats (medium) */}
          <section className="focus-card glass-md">
            <div className="focus-header">
              <div className="focus-icon">🌿</div>
              <h2>Current Goal</h2>
            </div>

            <div className="active-goal-title">{goal}</div>

            <div className="goal-summary">
              <div className="progress-indicator">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${activeGoalProgress}%` }} />
                </div>

                <div className="progress-text">{activeGoalProgress}%</div>
              </div>

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
            </div>
          </section>

          {/* Desktop Assistant (small) */}
          <section className="feed-sidebar glass-sm">
            <h2>Desktop Assistant</h2>

            {syncError && <p className="error-text">{syncError}</p>}

            {!deviceState ? (
              <p>Connecting...</p>
            ) : (
              <>
                <p>
                  Current task: {" "}
                  <strong>{currentDeviceTask?.text ?? "No task selected"}</strong>
                </p>

                <p>
                  Pomodoro: {" "}
                  <strong>{formatTimer(deviceTimer.remainingSeconds)}</strong>
                </p>

                <p>
                  Status: <strong>{deviceTimer.status ?? "unknown"}</strong>
                </p>
              </>
            )}
          </section>
          {/* Dog Circle */}
<section className="feed-sidebar glass-md">
  <h2>Dog Circle 🐾</h2>

  <p className="small-text">
    Share progress with other ShibaSteps users.
  </p>

  <div className="circle-score">
    <strong>
      Circle Points: {bonePoints + streak * 10}
    </strong>
  </div>

  <form
    className="post-composer"
    onSubmit={handleCreatePost}
  >
    <textarea
      value={postInput}
      onChange={(event) =>
        setPostInput(event.target.value)
      }
      placeholder="Share a small win..."
      maxLength={500}
      rows={3}
      disabled={postSubmitting}
    />

    <div className="post-composer-footer">
      <span>{postInput.length}/500</span>

      <button
        type="submit"
        disabled={
          postSubmitting ||
          postInput.trim().length === 0
        }
      >
        {postSubmitting
          ? "Publishing..."
          : "Post"}
      </button>
    </div>
  </form>

  {postsError && (
    <p className="error-text" role="alert">
      {postsError}
    </p>
  )}

  {postsLoading ? (
                  <p>Loading Dog Circle...</p>
                ) : posts.length === 0 ? (
                  <div className="empty-state">
                    <p>No posts yet.</p>
                    <p>Be the first Shiba to share an update.</p>
                  </div>
                ) : (
                  <div className="feed">
                    {posts.map((post) => {
                      const pending = pendingPostIds.has(post.id);

                      return (
                        <article className="post" key={post.id}>
                          <div className="post-header">
                            <strong>
                              {post.author?.displayName ||
                                "Shiba User"}
                            </strong>

                            <small>
                              {new Date(
                                post.createdAt,
                              ).toLocaleString("en-SG", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </small>
                          </div>

                          <p>{post.content}</p>

                          <div className="post-actions">
                            <button
                              type="button"
                              className={
                                post.likedByMe
                                  ? "like-button liked"
                                  : "like-button"
                              }
                              onClick={() =>
                                handleToggleLike(post)
                              }
                              disabled={pending}
                            >
                              {post.likedByMe ? "♥" : "♡"}{" "}
                              {post.likeCount}
                            </button>

                            {post.canDelete && (
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() =>
                                  handleDeletePost(post.id)
                                }
                                disabled={pending}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
          </aside>
      </main>
      </div>
    </motion.div>
  );
}

export default App;
