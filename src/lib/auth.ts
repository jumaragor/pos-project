import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
        if (!credentials?.username || !credentials.password) {
          return null;
        }
        const username = credentials.username.trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { username }
        });
        if (!user) {
          return null;
        }
        if (user.status !== "ACTIVE") {
          return null;
        }
        const matched = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!matched) {
          return null;
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
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
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.username = user.username;
        token.status = user.status;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.status = token.status as string;
      }
      return session;
    }
  }
};
