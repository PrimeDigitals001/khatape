import { createContext, useContext } from "react";

export const AuthContext = createContext({
  user: null,
  role: null,
  collectionId: null,
  loading: true,
  error: null,
  login: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
