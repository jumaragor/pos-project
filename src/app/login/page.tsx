"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogoMarkIcon } from "@/components/ui/app-icons";
import { PrimaryButton } from "@/components/ui/buttons";

function normalizeCallbackUrl(raw: string | null | undefined) {
  if (!raw) return "/dashboard";

  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login")) {
    return raw;
  }

  if (typeof window !== "undefined") {
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin && !url.pathname.startsWith("/login")) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return "/dashboard";
    }
  }

  return "/dashboard";
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch(callbackUrl);
  }, [callbackUrl, router]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await signIn("credentials", {
      username: username.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl
    });
    if (result?.error || !result?.ok) {
      setError("Invalid username or password");
      setIsLoading(false);
      return;
    }
    if (!rememberMe) {
      sessionStorage.setItem("microbiz.session.remember", "false");
    } else {
      sessionStorage.removeItem("microbiz.session.remember");
    }
    router.replace(normalizeCallbackUrl(result.url) || callbackUrl);
    router.refresh();
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
          <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
            <input
              type="text"
              name="fake-username"
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
            />
            <input
              type="password"
              name="fake-password"
              autoComplete="new-password"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
            />
            <label className="login-field">
              <span>Username</span>
              <input
                type="text"
                name="username"
                placeholder="Enter username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
              />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input
                placeholder="Enter password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={showPassword ? "off" : "new-password"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-shell" />}>
      <LoginPageContent />
    </Suspense>
  );
}
