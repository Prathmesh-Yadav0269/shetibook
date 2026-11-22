import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { AppLayout } from '../layouts/AppLayout';
import { WelcomePage } from '../../features/auth/pages/WelcomePage';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { RegisterPage } from '../../features/auth/pages/RegisterPage';
import { RecoveryPage } from '../../features/auth/pages/RecoveryPage';
import { RecoveryCodeDisplayPage } from '../../features/auth/pages/RecoveryCodeDisplayPage';
import { FamilySelectPage } from '../../features/family/pages/FamilySelectPage';
import { CreateFamilyPage } from '../../features/family/pages/CreateFamilyPage';
import { FamilyOverviewPage } from '../../features/family/pages/FamilyOverviewPage';
import { JoinFamilyPage } from '../../features/family/pages/JoinFamilyPage';
import { InviteMemberPage } from '../../features/family/pages/InviteMemberPage';
import { ProfilePage } from '../../features/family/pages/ProfilePage';
import { useAuth } from '../providers/AuthProvider';

const HomeRedirect: React.FC = () => {
  const { user, groups, selectedGroup } = useAuth();
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }
  if (selectedGroup) {
    return <Navigate to="/family/overview" replace />;
  }
  if (groups.length > 0) {
    return <Navigate to="/family/select" replace />;
  }
  return <Navigate to="/family/create" replace />;
};

export const router = createBrowserRouter([
  // Public routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/welcome', element: <WelcomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/recovery', element: <RecoveryPage /> },
      { path: '/recovery-code-display', element: <RecoveryCodeDisplayPage /> },
    ],
  },
  // Protected application routes
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/family/overview', element: <FamilyOverviewPage /> },
      { path: '/family/select', element: <FamilySelectPage /> },
      { path: '/family/create', element: <CreateFamilyPage /> },
      { path: '/family/join', element: <JoinFamilyPage /> },
      { path: '/family/invite', element: <InviteMemberPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
