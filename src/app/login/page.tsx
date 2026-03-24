"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogoMarkIcon } from "@/components/ui/app-icons";
import { PrimaryButton } from "@/components/ui/buttons";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("owner@microbiz.local");
  const [password, setPassword] = useState("Owner123!");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await signIn("credentials", {
      email: username,
      password,
      redirect: false
    });
    if (result?.error) {
      setError("Invalid credentials");
      setIsLoading(false);
      return;
    }
    if (!rememberMe) {
      sessionStorage.setItem("microbiz.session.remember", "false");
    } else {
      sessionStorage.removeItem("microbiz.session.remember");
    }
    router.push("/dashboard");
  }

  return (
    <div className="login-layout">
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="login-brand-mark">
            <LogoMarkIcon className="login-brand-icon" />
          </div>
          <h1 className="login-brand-title">MicroBiz POS</h1>
          <p className="login-brand-subtitle">Philippine Micro Retail System</p>
          <p className="login-brand-tagline">Helping micro retailers run smarter stores</p>
        </div>
        <div className="login-brand-graphic" aria-hidden="true">
          <div className="login-brand-blob login-brand-blob-1" />
          <div className="login-brand-blob login-brand-blob-2" />
          <div className="login-brand-grid" />
        </div>
      </section>

      <section className="login-form-pane">
        <div className="login-card">
          <h2 className="login-card-title">Sign in</h2>
          <p className="login-card-subtitle">Enter your account details to continue.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Username</span>
              <input
                placeholder="Enter username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input
                placeholder="Enter password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <div className="login-options">
              <label className="login-check">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                <span>Remember me</span>
              </label>
              <button type="button" className="login-link-btn" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? "Hide" : "Show"} password
              </button>
            </div>
            <PrimaryButton type="submit" disabled={isLoading} className="login-submit">
              {isLoading ? "Signing in..." : "Login"}
            </PrimaryButton>
          </form>
          {error ? <p className="login-error">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
