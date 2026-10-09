import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/Auth';
import Shell from './layouts/Shell';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import Profile from './pages/Profile';
import Assistant from './pages/Assistant';
import Applications from './pages/Applications';
import Deadlines from './pages/Deadlines';
import Resume from './pages/Resume';
import Skills from './pages/Skills';
import Settings from './pages/Settings';
import { Loading } from './components/UI';
function Protected() { const { user, loading } = useAuth(); return loading ? <Loading/> : user ? <Shell/> : <Navigate to="/login" replace/>; }
export default function App() { return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<Auth/>}/><Route element={<Protected/>}><Route index element={<Dashboard/>}/><Route path="scholarships" element={<Opportunities kind="scholarship"/>}/><Route path="jobs" element={<Opportunities kind="job"/>}/><Route path="profile" element={<Profile/>}/><Route path="assistant" element={<Assistant/>}/><Route path="applications" element={<Applications/>}/><Route path="deadlines" element={<Deadlines/>}/><Route path="resume" element={<Resume/>}/><Route path="skills" element={<Skills/>}/><Route path="settings" element={<Settings/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></AuthProvider></BrowserRouter>; }
