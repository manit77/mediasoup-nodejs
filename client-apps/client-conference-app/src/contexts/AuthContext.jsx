import { createContext, useState, useEffect } from 'react';
import { getToken, setToken, removeToken } from '../utils/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());

  useEffect(() => {
    if (token) {
      // Optionally fetch user data from API
      setUser({ username: 'example' }); // Replace with API call
    }
  }, [token]);

  const login = (newToken, userData) => {
    setToken(newToken);
    setTokenState(newToken);
    setUser(userData);
  };

  const logout = () => {
    removeToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};