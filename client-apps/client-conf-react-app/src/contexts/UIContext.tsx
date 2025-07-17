import React, { createContext, useContext, useState, ReactNode, useRef, useCallback, useMemo } from 'react';

// Define the types for the context
interface UIContextType {
  showPopup: (message: string, duration?: number) => void;
  showToast: (message: string, duration?: number) => void;
}

// Create the context
const UIContext = createContext<UIContextType | undefined>(undefined);

// Hook to use the context
export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

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
  const showPopup = useCallback((message: string, duration: number = 3000) => {
    setPopupMessage(message);
    setTimeout(() => {
      setPopupMessage(null);
    }, duration);
  }, []); // Empty deps: stable unless dependencies change (none here)

const showToast = useCallback((message: string, duration: number = 3000) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
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