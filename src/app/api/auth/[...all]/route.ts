import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/features/auth/lib";

export const { GET, POST } = toNextJsHandler(auth);
