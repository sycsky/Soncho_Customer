import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface ToastRef {
  show: () => void;
}

interface ToastProps {
  message: string;
  duration?: number;
}

export const Toast = forwardRef<ToastRef, ToastProps>(({ message, duration = 3000 }, ref) => {
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    show: () => {
      setVisible(true);
    }
  }));

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: '70px',
        left: '16px',
        right: '16px',
        zIndex: 1000,
        animation: 'fadeInSlideDown 0.3s ease-out forwards',
        pointerEvents: 'none' // 避免遮挡下方点击
      }}
    >
      <div 
        style={{
          backgroundColor: '#ecfdf5', // bg-green-50
          color: '#15803d', // text-green-700
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #dcfce7', // border-green-100
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          pointerEvents: 'auto'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{message}</span>
      </div>
      <style>{`
        @keyframes fadeInSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});
