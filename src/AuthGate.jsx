import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./AuthGate.css";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [displayName, setDisplayName] = useState("");

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setErrorMessage(error.message);
      }

      setSession(currentSession);
      setLoadingSession(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      if (mode === "register") {
  const trimmedDisplayName = displayName.trim();

  if (trimmedDisplayName.length === 0) {
    throw new Error(
      "Please enter a display name.",
    );
  }

  if (trimmedDisplayName.length > 40) {
    throw new Error(
      "Display name cannot exceed 40 characters.",
    );
  }

  const { data, error } =
    await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: trimmedDisplayName,
        },
      },
    });
      
      if (error) throw error;

        if (data.session) {
          setMessage("Account created. You are now signed in.");
        } else {
          setMessage(
            "Account created. Check your email and click the confirmation link before signing in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setErrorMessage(error.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setErrorMessage("");
    setMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setErrorMessage("");
  }

  if (loadingSession) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading">
          <div className="auth-dog">🐕</div>
          <p>Loading ShibaSteps...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-brand">
            <div className="auth-dog">🐕</div>
            <p className="auth-team">TEAM MIMIMI</p>
            <h1>ShibaSteps</h1>
            <p>
              Turn long-term goals into small daily steps and keep moving
              forward.
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "auth-tab active" : "auth-tab"}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>

            <button
              type="button"
              className={mode === "register" ? "auth-tab active" : "auth-tab"}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

         <form
  className="auth-form"
  onSubmit={handleSubmit}
>
  {mode === "register" && (
    <label>
      Display name
      <input
        type="text"
        value={displayName}
        onChange={(event) =>
          setDisplayName(event.target.value)
        }
        placeholder="How should other Shibas see you?"
        autoComplete="nickname"
        minLength={1}
        maxLength={40}
        required
      />
      <small className="auth-field-hint">
        This name will appear in Dog Circle.
      </small>
    </label>
  )}

  <label>
    Email
    <input
      type="email"
      value={email}
      onChange={(event) =>
        setEmail(event.target.value)
      }
      placeholder="you@example.com"
      autoComplete="email"
      required
    />
  </label>
   

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                minLength={6}
                required
              />
            </label>

            {message && <p className="auth-message">{message}</p>}

            {errorMessage && (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait..."
                : mode === "register"
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="session-bar">
        <span>
          Signed in as <strong>{session.user.email}</strong>
        </span>

        <button type="button" onClick={handleSignOut}>
          Log out
        </button>
      </div>

      {errorMessage && (
        <p className="session-error" role="alert">
          {errorMessage}
        </p>
      )}

      {children}
    </>
  );
}