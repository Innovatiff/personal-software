import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAkbbqdmZtYo83cErc_VvU-V1wfpCyNxho',
  authDomain: 'personal-software-3eb8a.firebaseapp.com',
  projectId: 'personal-software-3eb8a',
  storageBucket: 'personal-software-3eb8a.firebasestorage.app',
  messagingSenderId: '883075431266',
  appId: '1:883075431266:web:fb22817d817dc935d30a3b',
  measurementId: 'G-NGGL811363'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
