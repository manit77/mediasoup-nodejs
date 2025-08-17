import React, { createContext, useState, useRef, useCallback, useMemo } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { CheckCircleFill, ExclamationCircleFill, ExclamationTriangleFill } from 'react-bootstrap-icons';
import "./UIContext.css";

export type AlertType = 'normal' | 'error' | 'warning';

export interface UIContextType {
  hidePopUp: () => void;
  showPopUp: (message: string, type?: AlertType, durationSec?: number) => void;
  showToast: (message: string, type?: AlertType, durationSec?: number) => void;
}

export const UIContext = createContext<UIContextType | undefined>(undefined);

interface Toast {
  id: number;
  message: string;
  type: AlertType;
}

interface UIProviderProps {
  children: React.ReactNode;
}

interface PopupMessageProps {
  show: boolean;
  message?: string;
  handleClose: () => void;
  type?: AlertType;
}

const PopupMessage: React.FC<PopupMessageProps> = ({ show, message, handleClose, type = 'normal' }) => {
  const alertStyles = {
    normal: { icon: <CheckCircleFill size={24} />, bgClass: 'bg-success-subtle', borderClass: 'border-success', title: 'Success' },
    error: { icon: <ExclamationCircleFill size={24} />, bgClass: 'bg-danger-subtle', borderClass: 'border-danger', title: 'Error' },
    warning: { icon: <ExclamationTriangleFill size={24} />, bgClass: 'bg-warning-subtle', borderClass: 'border-warning', title: 'Warning' },
  };

  const { icon, bgClass, borderClass, title } = alertStyles[type];

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop="static"
      keyboard={false}
      className="popup-message"
    >
      <Modal.Header className={`border-0 ${bgClass}`}>
        <Modal.Title className="d-flex align-items-center">
          <span className="me-2">{icon}</span>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className={`${bgClass} ${borderClass}`}>
        {message || 'No message provided'}
      </Modal.Body>
      <Modal.Footer className="border-0 bg-light">
        <Button variant="outline-secondary" onClick={handleClose}>
          OK
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [popup, setPopup] = useState<{ message: string; type: AlertType } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const hidePopUp = useCallback(() => {
    setPopup(null);
  }, []);

  const showPopUp = useCallback((message: string, type: AlertType = 'normal', durationSec: number = 5) => {
    setPopup({ message, type });
    setTimeout(() => {
      setPopup(null);
    }, durationSec * 1000);
  }, []);

  const showToast = useCallback((message: string, type: AlertType = 'normal', durationSec: number = 5) => {
    console.log('showToast', message, type);
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationSec * 1000);
  }, []);

  const contextValue = useMemo(() => ({ showPopUp, showToast, hidePopUp }), [showPopUp, showToast, hidePopUp]);

  return (
    <UIContext.Provider value={contextValue}>
      {children}
      <PopupMessage show={popup !== null} handleClose={hidePopUp} message={popup?.message} type={popup?.type} />
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`alert alert-${toast.type} toast fade show`}
            role="alert"
          >
            <span>{toast.message}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            ></button>
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
};