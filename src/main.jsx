import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import App from './App.jsx';import './styles.css';import './ux.css';import './polish.css';import './brand.css';
import ExperienceLayer from './components/ExperienceLayer.jsx';import './responsive.css';
import './experience.css';
createRoot(document.getElementById('root')).render(<BrowserRouter><App/><ExperienceLayer/></BrowserRouter>);