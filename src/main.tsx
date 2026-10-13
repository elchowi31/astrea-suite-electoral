import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DevicePersistenceBoundary } from './components/DevicePersistence';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevicePersistenceBoundary><App /></DevicePersistenceBoundary>
  </StrictMode>,
);
