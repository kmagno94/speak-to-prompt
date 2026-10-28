// channel.js comes first: on the staging build it prefixes saved keys before anything reads them.
import { showStagingBadge } from './lib/channel.js';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

showStagingBadge();
mount(App, { target: document.getElementById('app') });
