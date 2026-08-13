import type { User } from "../schema";

// Single-user workspace: no accounts, no login. Every request acts as the
// workspace owner so the existing tRPC procedures keep working unchanged.
export const SINGLE_USER: User = {
  id: 1,
  openId: "workspace-owner",
  name: "Workspace Owner",
  email: null,
  loginMethod: null,
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export type TrpcContext = {
  user: User;
};

export async function createContext(_opts?: unknown): Promise<TrpcContext> {
  return { user: SINGLE_USER };
}