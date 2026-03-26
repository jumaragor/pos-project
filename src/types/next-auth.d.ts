import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    role: string;
    status: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
      status: string;
    } & DefaultSession["user"];
  }

  interface AdapterUser {
    id: string;
    username?: string | null;
    role: string;
    status?: string;
    email: string;
    emailVerified: Date | null;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: string;
    status?: string;
  }
}
