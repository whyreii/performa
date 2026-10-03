import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Search, Settings, Palette, X, Bell, ArrowUp, ArrowDown } from 'lucide-react';
import { commandNav } from '../../config/nav';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPalette } = useTheme();

  const role = user?.role;

  // Base navigation commands based on role
  const getCommands = () => {
    const list = commandNav(role).map((item) => ({
      id: item.path,
      label: item.label,
      category: 'Navigation',
      icon: item.icon,
      action: () => navigate(item.path),
    }));

    list.push(
      { id: 'notifications', label: 'View Notifications', category: 'Navigation', icon: Bell, action: () => navigate('/notifications') },
      { id: 'settings', label: 'Platform & Profile Settings', category: 'Navigation', icon: Settings, action: () => navigate('/settings') },
      { id: 'th-paper', label: 'Switch theme to Paper (Warm Light)', category: 'Appearance', icon: Palette, action: () => setPalette('paper') },
      { id: 'th-midnight', label: 'Switch theme to Midnight (Obsidian Dark)', category: 'Appearance', icon: Palette, action: () => setPalette('midnight') },
      { id: 'th-dusk', label: 'Switch theme to Dusk (Amethyst Dark)', category: 'Appearance', icon: Palette, action: () => setPalette('dusk') },
      { id: 'th-mist', label: 'Switch theme to Mist (Scandinavian Slate)', category: 'Appearance', icon: Palette, action: () => setPalette('mist') },
      { id: 'th-sage', label: 'Switch theme to Sage (Calm Herbal)', category: 'Appearance', icon: Palette, action: () => setPalette('sage') },
    );

    return list;
  };

  const allCommands = getCommands();
  const filtered = query.trim()
    ? allCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase()))
    : allCommands;

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-[12vh] p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-side border border-line rounded-float shadow-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-line px-4 transition-colors focus-within:border-accent">
          <Search className="w-5 h-5 text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="w-full h-14 px-3 bg-transparent text-ink placeholder:text-ink-3 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-ctl text-ink-3 hover:text-ink hover:bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command list */}
        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-3">
              No matching commands or pages found.
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-ctl cursor-pointer text-xs transition-colors ${
                    isSelected ? 'bg-hover text-ink font-medium' : 'text-ink-2 hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-ink-3 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-ink-3 uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-line flex items-center justify-between text-[11px] text-ink-3 font-mono bg-surface/30">
          <span className="inline-flex items-center gap-1">
            Navigate with
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            · Press Enter to execute
          </span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
