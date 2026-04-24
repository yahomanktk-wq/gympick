import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '../data/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  managedGymIds: string[];
}

interface AuthContextValue {
  user: AuthUser;
  switchRole: (role: UserRole) => void;
}

// ─── Mock users (one per role) ────────────────────────────────────────────────

const MOCK_USERS: Record<UserRole, AuthUser> = {
  user: {
    id: 'u1',
    name: 'Alex Park',
    email: 'alex@gympick.io',
    role: 'user',
    managedGymIds: [],
  },
  manager: {
    id: 'u2',
    name: 'Jordan Kim',
    email: 'jordan@ironhub.kr',
    role: 'manager',
    managedGymIds: ['g01', 'g02'],
  },
  admin: {
    id: 'u3',
    name: 'Sam Lee',
    email: 'sam@gympick.io',
    role: 'admin',
    managedGymIds: [],
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: MOCK_USERS.user,
  switchRole: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(MOCK_USERS.user);
  return (
    <AuthContext.Provider value={{ user, switchRole: role => setUser(MOCK_USERS[role]) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
