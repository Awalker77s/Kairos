import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { roleOptions, useAuth } from "../context/AuthContext";
import { BrandWordmark } from "../components/BrandWordmark";

export function SignUpPage() {
  const { user, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState(roleOptions[0]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password, role);
      setSuccessMessage(
        "Check your email for the confirmation link to complete sign up.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign up. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to continue with Google.",
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-6xl items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-warm-border bg-warm-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-warm-black">
          Create your <BrandWordmark size="md" className="align-middle" />{" "}
          account
        </h1>
        <p className="mt-2 text-sm text-warm-stone">
          Start turning ideas into plans, models, and renders.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-warm-black">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-warm-border bg-cream px-3 py-2.5 text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="block text-sm font-medium text-warm-black">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-warm-border bg-cream px-3 py-2.5 text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="block text-sm font-medium text-warm-black">
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-warm-border bg-cream px-3 py-2.5 text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="block text-sm font-medium text-warm-black">
            Role
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as (typeof roleOptions)[number])
              }
              className="mt-1 w-full rounded-lg border border-warm-border bg-cream px-3 py-2.5 text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Creating account\u2026" : "Sign Up"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="mt-3 w-full rounded-lg border border-warm-border px-4 py-2.5 font-medium text-warm-black transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-70"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-warm-stone">
          Already have an account?{" "}
          <Link
            to="/signin"
            className="font-medium text-gold hover:text-gold-dark"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
