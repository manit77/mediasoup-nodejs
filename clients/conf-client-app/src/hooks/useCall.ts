import { useContext } from 'react';
import { CallContext } from '@client/contexts/CallContext';

export const useCall = () => {
    const context = useContext(CallContext);
    if (context === undefined) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};