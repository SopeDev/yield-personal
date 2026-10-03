import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/db/client";
import { isAllowedEmail } from "@/lib/env";
import { createUserDefaults } from "@/lib/user-defaults";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    // Yield Personal holds private financial data: only allow-listed accounts may sign in.
    signIn({ user }) {
      return isAllowedEmail(user.email);
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) await createUserDefaults(user.id);
    },
  },
});
