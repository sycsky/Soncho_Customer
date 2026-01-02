import React, { useState } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import './WidgetLauncher.css';

interface WidgetLauncherProps {
  mode: 'bubble' | 'search';
  onOpen: (initialMessage?: string) => void;
  isOpen: boolean;
}

export const WidgetLauncher: React.FC<WidgetLauncherProps> = ({ mode, onOpen, isOpen }) => {
  const [searchValue, setSearchValue] = useState('');

  if (isOpen) return null; // Hide launcher when chat is open

  if (mode === 'search') {
    return (
      <div className="widget-launcher-search-container">
        <div className="search-bar-wrapper">
          <Search className="search-icon" size={24} />
          <input
            type="text"
            className="search-input"
            placeholder="有什么可以帮您？"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchValue.trim()) {
                onOpen(searchValue);
                setSearchValue('');
              }
            }}
          />
        </div>
      </div>
    );
  }

  // Default Bubble Mode
  return (
    <button className="widget-launcher-bubble" onClick={() => onOpen()}>
      <MessageCircle size={32} />
    </button>
  );
};
