// Configuración e inicialización de Firebase para ClayHand 3D.
// Este archivo se carga como módulo ES (<script type="module" src="./firebaseConfig.js">)
// desde cada página del sitio. Antes tenía una etiqueta <script> de HTML pegada
// adentro por error, lo que hacía que el navegador rechazara el archivo entero
// (error de sintaxis) y Firebase nunca llegaba a inicializarse.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Configuración de la app web de Firebase (proyecto clayhand3d).
const firebaseConfig = {
  apiKey: "AIzaSyB-7iYqVG7S0kE1aT8ondEj6zkxZ3s-sd4",
  authDomain: "clayhand3d.firebaseapp.com",
  projectId: "clayhand3d",
  storageBucket: "clayhand3d.firebasestorage.app",
  messagingSenderId: "34968086919",
  appId: "1:34968086919:web:0c1205935936fbafc64b22",
  measurementId: "G-WXT6L8EKRJ"
};

// Se inicializa una sola vez acá y se exportan las instancias para que el
// resto del sitio (auth.js, etc.) las reutilice en vez de inicializar
// Firebase de nuevo en cada página.
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Analytics solo debe iniciarse si el navegador lo soporta (evita errores en
// navegadores con bloqueadores de rastreo).
export let analytics = null;
isAnalyticsSupported()
  .then((supported) => {
    if (supported) analytics = getAnalytics(app);
  })
  .catch(() => {
    /* no pasa nada si Analytics no está disponible */
  });
