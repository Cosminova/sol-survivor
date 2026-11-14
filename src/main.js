// Entry point: styles first, then boot the app shell. No framework, no dependencies.
import './styles.css';
import './ui/dataLab.css';
import { boot } from './ui/app.js';

boot(document.getElementById('app'));
