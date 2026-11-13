import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import i18n from './i18n';
import App from './App';
import axios from 'axios';
import { API_BASE } from './config';

// Configure global axios defaults
axios.defaults.baseURL = API_BASE;
axios.defaults.withCredentials = true;
// The API answers (messages) in the interface language
const setApiLanguage = (lng) => { axios.defaults.headers.common['Accept-Language'] = (lng || 'en').slice(0, 2); };
setApiLanguage(i18n.resolvedLanguage);
i18n.on('languageChanged', setApiLanguage);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
);

