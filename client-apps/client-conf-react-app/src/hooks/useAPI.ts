import { useContext } from 'react';
import { APIContext } from '../contexts/APIContext';

export const useAPI = () => {
    const context = useContext(APIContext);
    if (context === undefined) {
        throw new Error('useAPI must be used within an APIProvider');
    }
    return context;
};