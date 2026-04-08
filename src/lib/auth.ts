import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { startPerfTimer } from "@/lib/perf";

export const authOptions: NextAuthOptions = {
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
        if (!credentials?.username || !credentials.password) {
          authorizeTimer.end({ result: "missing-credentials" });
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
          return null;
        }
        if (user.status !== "ACTIVE") {
          authorizeTimer.end({ result: "inactive" });
          return null;
        }
        const compareTimer = startPerfTimer("auth.passwordCompare");
        const matched = await bcrypt.compare(credentials.password, user.passwordHash);
        compareTimer.end({ matched });
        if (!matched) {
          authorizeTimer.end({ result: "password-mismatch" });
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
      return session;
    }
  }
};
