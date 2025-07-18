import React, { createContext, useContext, useState, ReactNode, useRef, useCallback, useMemo } from 'react';

// Define the types for the context
export interface UIContextType {
  showPopup: (message: string, durationSec?: number) => void;
  showToast: (message: string, durationSec?: number) => void;
}

export const UIContext = createContext<UIContextType | undefined>(undefined);

// Type for toast items
interface Toast {
  id: number;
  message: string;
}

// Provider component
interface UIProviderProps {
  children: ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

// Memoize the functions with useCallback
  const showPopup = useCallback((message: string, durationSec: number = 3) => {
    setPopupMessage(message);
    setTimeout(() => {
      setPopupMessage(null);
    }, durationSec * 1000);
  }, []); // Empty deps: stable unless dependencies change (none here)

const showToast = useCallback((message: string, durationSec: number = 3) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationSec * 1000);
  }, []); // Empty deps: stable

  const contextValue = useMemo(() => ({ showPopup, showToast }), [showPopup, showToast]);

  return (
    <UIContext.Provider value={contextValue}>
      {children}
      {popupMessage && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            zIndex: 1000,
          }}
        >
          {popupMessage}
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '4px',
              minWidth: '200px',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
};