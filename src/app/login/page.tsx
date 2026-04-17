"use client";

import Image from "next/image";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/buttons";
import { authClientDebug } from "@/lib/auth-debug";

const LOGIN_CAROUSEL_SLIDES = [
  {
    src: "/login-carousel-1.svg",
    alt: "Retail counter with products and payment terminal"
  },
  {
    src: "/login-carousel-2.svg",
    alt: "Modern grocery aisle with organized shelves"
  },
  {
    src: "/login-carousel-3.svg",
    alt: "Store workstation with inventory and checkout tools"
  },
  {
    src: "/login-carousel-4.svg",
    alt: "Barcode scanning and inventory workflow station"
  },
  {
    src: "/login-carousel-5.svg",
    alt: "Sales dashboard and storefront operations display"
  }
] as const;

type LoginCarouselImageSetting = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
};

type LoginCarouselSlide = {
  src: string;
  alt: string;
};

function isRemoteImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

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
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselSlides, setCarouselSlides] = useState<LoginCarouselSlide[]>([...LOGIN_CAROUSEL_SLIDES]);
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
      authClientDebug("login.redirect-authenticated", { callbackUrl });
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  useEffect(() => {
    let mounted = true;

    async function loadCarouselImages() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          loginCarouselImages?: LoginCarouselImageSetting[];
        };

        const configuredSlides =
          payload.loginCarouselImages
            ?.filter((image) => image?.isActive !== false && typeof image?.url === "string" && image.url.trim())
            .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
            .map((image) => ({
              src: image.url.trim(),
              alt: image.alt?.trim() || "Login carousel image"
            })) ?? [];

        if (!mounted) return;
        setCarouselSlides(configuredSlides.length ? configuredSlides : [...LOGIN_CAROUSEL_SLIDES]);
      } catch {
        if (!mounted) return;
        setCarouselSlides([...LOGIN_CAROUSEL_SLIDES]);
      }
    }

    void loadCarouselImages();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [carouselSlides.length]);

  useEffect(() => {
    setActiveSlide((prev) => (prev >= carouselSlides.length ? 0 : prev));
  }, [carouselSlides.length]);

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
    authClientDebug("login.signin-result", {
      ok: result?.ok ?? false,
      error: result?.error ?? null,
      url: result?.url ?? null,
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
    const target = normalizeCallbackUrl(result?.url) || callbackUrl;
    authClientDebug("login.navigate", { target });
    window.location.assign(target);
  }

  return (
    <div className="login-layout">
      <div className="login-stage">
        <div className="login-stage-orb login-stage-orb-primary" aria-hidden="true" />
        <div className="login-stage-orb login-stage-orb-accent" aria-hidden="true" />
        <div className="login-stage-grid" aria-hidden="true" />

        <div className="login-surface">
          <section className="login-form-pane">
            <div className="login-card">
              <div className="login-card-copy">
                <h2 className="login-card-title">Sign in</h2>
                <p className="login-card-subtitle">
                  Access your POS workspace and continue managing daily store operations.
                </p>
              </div>
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
                  <span className="login-submit-content">
                    <span
                      aria-hidden="true"
                      className={isLoading ? "login-submit-spinner is-active" : "login-submit-spinner"}
                    />
                    <span>Login</span>
                  </span>
                </PrimaryButton>
              </form>
              {error ? <p className="login-error">{error}</p> : null}
            </div>
          </section>

          <section className="login-brand" aria-label="Store gallery">
            <div className="login-carousel" aria-hidden="true">
              {carouselSlides.map((slide, index) => (
                <div
                  key={slide.src}
                  className={index === activeSlide ? "login-carousel-slide is-active" : "login-carousel-slide"}
                >
                  {isRemoteImageUrl(slide.src) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      className="login-carousel-image login-carousel-image-native"
                    />
                  ) : (
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      priority={index === 0}
                      sizes="(max-width: 980px) 100vw, 48vw"
                      className="login-carousel-image"
                    />
                  )}
                </div>
              ))}
              <div className="login-carousel-overlay" />
              <div className="login-carousel-dots">
                {carouselSlides.map((slide, index) => (
                  <span
                    key={slide.src}
                    className={index === activeSlide ? "login-carousel-dot is-active" : "login-carousel-dot"}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
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
