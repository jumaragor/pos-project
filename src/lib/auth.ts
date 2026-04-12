import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { startPerfTimer } from "@/lib/perf";
import { authDebug } from "@/lib/auth-debug";

const resolvedAuthUrl =
  process.env.NEXTAUTH_URL ||
  process.env.AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
  debug: process.env.AUTH_DEBUG === "true",
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 60
  },
  jwt: {
    maxAge: 60 * 60 * 8
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const authorizeTimer = startPerfTimer("auth.authorize");
        authDebug("authorize.start", {
          usernameProvided: Boolean(credentials?.username),
          authUrl: resolvedAuthUrl ?? null
        });
        if (!credentials?.username || !credentials.password) {
          authorizeTimer.end({ result: "missing-credentials" });
          authDebug("authorize.missing-credentials");
          return null;
        }
        const username = credentials.username.trim().toLowerCase();
        const userLookupTimer = startPerfTimer("auth.userLookup");
        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            status: true,
            passwordHash: true
          }
        });
        userLookupTimer.end({ found: Boolean(user) });
        if (!user) {
          authorizeTimer.end({ result: "user-not-found" });
          authDebug("authorize.user-not-found", { username });
          return null;
        }
        if (user.status !== "ACTIVE") {
          authorizeTimer.end({ result: "inactive" });
          authDebug("authorize.inactive", { userId: user.id, status: user.status });
          return null;
        }
        const compareTimer = startPerfTimer("auth.passwordCompare");
        const matched = await bcrypt.compare(credentials.password, user.passwordHash);
        compareTimer.end({ matched });
        if (!matched) {
          authorizeTimer.end({ result: "password-mismatch" });
          authDebug("authorize.password-mismatch", { userId: user.id });
          return null;
        }
        void prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
          })
          .catch(() => {
            // Non-blocking audit field update only.
          });
        authorizeTimer.end({ result: "success" });
        authDebug("authorize.success", {
          userId: user.id,
          role: user.role,
          resolvedAuthUrl: resolvedAuthUrl ?? null
        });
        return {
          id: user.id,
          name: user.name,
          username: user.username ?? "",
          email: user.email,
          role: user.role,
          status: user.status
        };
      }
    })
  ],
  pages: {
    signIn: "/login"
  },
  callbacks: {
    jwt: ({ token, user }) => {
      const timer = startPerfTimer("auth.jwt");
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.username = user.username;
        token.status = user.status;
      }
      timer.end({ hasUser: Boolean(user) });
      authDebug("jwt.callback", {
        hasUser: Boolean(user),
        tokenId: typeof token.id === "string" ? token.id : null
      });
      return token;
    },
    session: ({ session, token }) => {
      const timer = startPerfTimer("auth.session");
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.status = token.status as string;
      }
      timer.end();
      authDebug("session.callback", {
        userId: session.user?.id ?? null,
        role: session.user?.role ?? null
      });
      return session;
    },
    redirect: ({ url, baseUrl }) => {
      const timer = startPerfTimer("auth.redirect");
      if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/login")) {
        const resolved = `${baseUrl}${url}`;
        timer.end({ target: resolved });
        authDebug("redirect.relative", { url, baseUrl, target: resolved });
        return resolved;
      }

      try {
        const target = new URL(url);
        if (target.origin === baseUrl && !target.pathname.startsWith("/login")) {
          timer.end({ target: target.toString() });
          authDebug("redirect.same-origin", { url, baseUrl, target: target.toString() });
          return target.toString();
        }
      } catch {
        // Fall back to baseUrl below.
      }

      const fallback = `${baseUrl}/dashboard`;
      timer.end({ target: fallback, fallback: true });
      authDebug("redirect.fallback", { url, baseUrl, target: fallback });
      return fallback;
    }
  }
};
