import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/auth/me').then(r => setUser(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  const logout = async () => { await api.post('/auth/logout'); setUser(null); };
  return <Context.Provider value={{ user, setUser, loading, logout }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
