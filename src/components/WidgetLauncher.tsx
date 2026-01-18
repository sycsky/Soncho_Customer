import React, { useState } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import './WidgetLauncher.css';

interface WidgetLauncherProps {
  mode: 'bubble' | 'search';
  onOpen: (initialMessage?: string) => void;
  isOpen: boolean;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const WidgetLauncher: React.FC<WidgetLauncherProps> = ({ 
  mode, 
  onOpen, 
  isOpen, 
  primaryColor, 
  position = 'bottom-right' 
}) => {
  const [searchValue, setSearchValue] = useState('');

  if (isOpen) return null; // Hide launcher when chat is open

  // 计算位置样式
  const getPositionStyle = () => {
    switch (position) {
      case 'bottom-left':
        return { bottom: '20px', left: '20px', right: 'auto', top: 'auto' };
      case 'top-right':
        return { top: '20px', right: '20px', bottom: 'auto', left: 'auto' };
      case 'top-left':
        return { top: '20px', left: '20px', bottom: 'auto', right: 'auto' };
      case 'bottom-right':
      default:
        return { bottom: '20px', right: '20px', top: 'auto', left: 'auto' };
    }
  };

  const positionStyle = getPositionStyle();

  if (mode === 'search') {
    return (
      <div className="widget-launcher-search-container" style={positionStyle}>
        <div className="search-bar-wrapper" style={{ borderColor: primaryColor }}>
          <Search className="search-icon" size={24} color={primaryColor} />
          <input
            type="text"
            className="search-input"
            placeholder={t('search_placeholder')}
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
    <button 
      className="widget-launcher-bubble" 
      onClick={() => onOpen()}
      style={{ 
        backgroundColor: primaryColor,
        ...positionStyle
      }}
    >
      <MessageCircle size={32} />
    </button>
  );
};
