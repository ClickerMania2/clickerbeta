const firebaseConfig = {
    apiKey: "AIzaSyAvh_w1Nb2LGuuT5UV6iEGOsMzTco-wdK4",
    authDomain: "betatesting-web.firebaseapp.com",
    databaseURL: "https://betatesting-web-default-rtdb.firebaseio.com",
    projectId: "betatesting-web",
    storageBucket: "betatesting-web.firebasestorage.app",
    messagingSenderId: "1021238456567",
    appId: "1:1021238456567:web:67f2c02278b9fa14d7a3f2"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener referencia a la base de datos
const database = firebase.database();

// Exportar para uso global
window.firebaseDB = database;
