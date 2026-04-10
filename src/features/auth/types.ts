export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  image?: string | null;
};
