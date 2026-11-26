import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../../services/api/apiClient';
import { User, UserGroupInfo, MeResponse } from '../../features/auth/types';

interface AuthContextType {
  user: User | null;
  groups: UserGroupInfo[];
  selectedGroup: UserGroupInfo | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setGroups: (groups: UserGroupInfo[]) => void;
  selectGroup: (groupId: string) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<UserGroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<UserGroupInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await api.get<MeResponse>('/auth/me');
      setUser(data.user);
      setGroups(data.groups);

      // Restore selected group from memory/storage or default to first
      const savedGroupId = localStorage.getItem('shetibook_selected_group');
      const found = data.groups.find(g => g.id === savedGroupId);
      if (found) {
        setSelectedGroup(found);
      } else if (data.groups.length > 0) {
        setSelectedGroup(data.groups[0]);
        localStorage.setItem('shetibook_selected_group', data.groups[0].id);
      } else {
        setSelectedGroup(null);
      }
    } catch {
      setUser(null);
      setGroups([]);
      setSelectedGroup(null);
    } finally {
      setIsLoading(false);
    }
  };

  const selectGroup = (groupId: string) => {
    const found = groups.find(g => g.id === groupId);
    if (found) {
      setSelectedGroup(found);
      localStorage.setItem('shetibook_selected_group', groupId);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    try {
      // Clear non-persistent local caches on logout for data privacy
      const { clearCachedRecords } = await import('../../features/offline/services/indexedDb');
      await clearCachedRecords();
    } catch {}
    setUser(null);
    setGroups([]);
    setSelectedGroup(null);
    localStorage.removeItem('shetibook_selected_group');
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        groups,
        selectedGroup,
        isLoading,
        setUser,
        setGroups,
        selectGroup,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
