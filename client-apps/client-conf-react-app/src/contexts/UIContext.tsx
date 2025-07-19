import React, { createContext, useState, ReactNode, useRef, useCallback, useMemo, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap'; // Import Modal and Button from react-bootstrap

// Define the types for the context
export interface UIContextType {
  hidePopUp: () => void;
  showPopUp: (message: string, durationSec?: number) => void;
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

  const popupRef = useRef<HTMLDivElement>(null); // Optional: Keep if needed for other purposes, but not required for Modal

  const hidePopUp = useCallback(() => {
    setPopupMessage(null);
  }, []);

  // Memoize the functions with useCallback
  const showPopUp = useCallback((message: string, durationSec: number = 3) => {
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

  const contextValue = useMemo(() => ({ showPopUp, showToast, hidePopUp }), [showPopUp, showToast, hidePopUp]);

  return (
    <UIContext.Provider value={contextValue}>
      {children}
      <Modal
        show={popupMessage !== null}
        centered
        backdrop="static"
        keyboard={true}
        onHide={hidePopUp} // Handles backdrop clicks and ESC key (but keyboard={false} disables ESC)
        ref={popupRef} // Optional: Attach ref if needed (e.g., for custom click-outside logic)
      >
        <Modal.Header>
          <Modal.Title>Alert</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {popupMessage}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={hidePopUp}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>
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