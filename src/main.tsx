import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { AppInput } from './ui/AppInput';
import { applyAppCursors } from './ui/toolCursors';
import { applyTheme, readTheme } from './ui/theme';
import './ui/styles.css';
import '@fontsource-variable/nunito';

const root = document.getElementById('root');
if (!root) throw new Error('Studioodle root element is missing.');

applyTheme(readTheme());
applyAppCursors();
createRoot(root).render(<StrictMode><AppInput><App /></AppInput></StrictMode>);
