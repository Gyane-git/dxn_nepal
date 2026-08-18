import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      role: "USER" | "ADMIN" | "DISTRIBUTOR";
    } & DefaultSession["user"];
  }

  interface User {
    id: number;
    role: "USER" | "ADMIN" | "DISTRIBUTOR";
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number;
    role: "USER" | "ADMIN" | "DISTRIBUTOR";
    picture?: string | null;
  }
}
