import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ResetPassword from './ResetPassword';
import './index.css';
createRoot(document.getElementById('root')!).render(<StrictMode><ResetPassword /></StrictMode>);