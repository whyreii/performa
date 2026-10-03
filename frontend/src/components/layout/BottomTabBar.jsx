import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tabNav } from '../../config/nav';

const TAB_GRID = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export default function BottomTabBar() {
  const { user } = useAuth();
  const role = user?.role;

  const tabs = tabNav(role);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-side/95 backdrop-blur-md border-t border-line px-2 py-1 shadow-lg pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]"
      aria-label="Mobile Navigation"
    >
      <div className={`grid gap-1 ${TAB_GRID[tabs.length] || 'grid-cols-5'}`}>
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
