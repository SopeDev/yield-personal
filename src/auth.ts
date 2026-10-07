import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/db/client";
import { isAllowedEmail } from "@/lib/env";
import { createUserDefaults } from "@/lib/user-defaults";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google],
  // A signed cookie instead of a database session: pages read the user without a database round trip first.
  // The adapter still stores users and accounts.
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    // Yield Personal holds private financial data: only allow-listed accounts may sign in.
    signIn({ user }) {
      return isAllowedEmail(user.email);
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) await createUserDefaults(user.id);
    },
  },
});
