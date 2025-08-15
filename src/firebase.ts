import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGEBUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: false,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// TTL configuration - 8 hours in seconds
export const GAME_TTL_SECONDS = 8 * 60 * 60; // 8 hours

// Helper function to create a document with TTL
export const createDocumentWithTTL = async (collectionRef: any, docId: string, data: any) => {
  const ttlTimestamp = new Date();
  ttlTimestamp.setSeconds(ttlTimestamp.getSeconds() + GAME_TTL_SECONDS);
  
  return {
    ...data,
    _ttl: ttlTimestamp,
    createdAt: new Date()
  };
};
