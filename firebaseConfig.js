<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyB-7iYqVG7S0kE1aT8ondEj6zkxZ3s-sd4",
    authDomain: "clayhand3d.firebaseapp.com",
    projectId: "clayhand3d",
    storageBucket: "clayhand3d.firebasestorage.app",
    messagingSenderId: "34968086919",
    appId: "1:34968086919:web:0c1205935936fbafc64b22",
    measurementId: "G-WXT6L8EKRJ"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
