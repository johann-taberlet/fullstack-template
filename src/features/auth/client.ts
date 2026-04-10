"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient(), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
