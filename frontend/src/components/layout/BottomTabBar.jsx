import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  History,
  Settings,
  Target,
  Award,
  BookOpen,
} from 'lucide-react';

export default function BottomTabBar() {
  const { user } = useAuth();
  const role = user?.role;

  const getTabs = () => {
    if (role === 'admin' || role === 'employer') {
      return [
        { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Directory', path: '/employees', icon: Users },
        { label: 'Rollups', path: '/rollups', icon: FileCheck2 },
        { label: 'Audits', path: '/audits', icon: History },
        { label: 'Settings', path: '/settings', icon: Settings },
      ];
    }
    if (role === 'supervisor') {
      return [
        { label: 'Overview', path: '/supervisor/dashboard', icon: LayoutDashboard },
        { label: 'Team', path: '/employees', icon: Users },
        { label: 'Rate', path: '/supervisor/rate', icon: Award },
        { label: 'Rubrics', path: '/supervisor/rubrics', icon: Target },
        { label: 'Settings', path: '/settings', icon: Settings },
      ];
    }
    // Employee
    return [
      { label: 'Scorecard', path: '/employee/dashboard', icon: Award },
      { label: 'Training', path: '/employee/training', icon: BookOpen },
      { label: 'Settings', path: '/settings', icon: Settings },
    ];
  };

  const tabs = getTabs();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-side/95 backdrop-blur-md border-t border-line px-2 py-1 shadow-lg pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]"
      aria-label="Mobile Navigation"
    >
      <div className={`grid gap-1 ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-5'}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-1 rounded-nav text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent font-semibold' : 'text-ink-3 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 mb-0.5 transition-transform ${
                      isActive ? 'scale-110' : ''
                    }`}
                  />
                  <span className="truncate">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
