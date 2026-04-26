import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import PetApp from './PetApp.vue'
import './style.css'

// Pet window vs main window: same Vite bundle, same origin, same Pinia
// instance. We pick the root component by URL hash because Tauri loads
// the secondary window with `index.html#/pet`. State sync between the
// two webviews flows over BroadcastChannel — see useBroadcastSync.js.
const isPetWindow = typeof window !== 'undefined' && window.location.hash === '#/pet'
const Root = isPetWindow ? PetApp : App

const app = createApp(Root)
app.use(createPinia())
app.mount('#app')
