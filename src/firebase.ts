import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD_pKXAfVOOrw0nF8e7yHLpJpJPWjSl5Pk",
  authDomain: "bunco-f549e.firebaseapp.com",
  projectId: "bunco-f549e",
  storageBucket: "bunco-f549e.firebasestorage.app",
  messagingSenderId: "855662635115",
  appId: "1:855662635115:web:78732f331cb5702093e92e"
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: false,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
