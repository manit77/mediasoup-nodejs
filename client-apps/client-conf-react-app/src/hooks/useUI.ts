import { useContext } from 'react';
import { UIContext, UIContextType } from '../contexts/UIContext';

// Hook to use the context
export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
