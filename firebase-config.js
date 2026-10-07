// ============================================================
// FIREBASE CONFIG — apna config yahan daalein
// Firebase Console → Project Settings → Web App → Config
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCNZeCGB0DvnSCGC5WAbmOHhOJOPde0W5M",
  authDomain: "my-tempmail-web.firebaseapp.com",
  projectId: "my-tempmail-web",
  storageBucket: "my-tempmail-web.firebasestorage.app",
  messagingSenderId: "385333078679",
  appId: "1:385333078679:web:dbb5d99b9df3be1c8057d2"
};

// ============================================================
// Firebase Console Setup Karne Ka Tareeqa:
// ============================================================
//
// 1. console.firebase.google.com par jao
// 2. Naya project banao: "AhsanXNova"
// 3. Web app add karo (</> icon)
// 4. Config copy karo aur upar paste karo
//
// AUTHENTICATION:
// 5. Left menu → Authentication → Get Started
// 6. Sign-in method → Email/Password → Enable
//
// FIRESTORE:
// 7. Left menu → Firestore Database → Create database
// 8. Location: asia-south1 (ya jo nazdeek ho)
// 9. Mode: Production mode
// 10. Rules tab mein ye paste karo:
//
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /users/{uid}/mailboxes/{mailId} {
//           allow read, write: if request.auth != null
//                              && request.auth.uid == uid;
//         }
//       }
//     }
//
// 11. Publish karo
//
// AUTHORIZED DOMAINS:
// 12. Authentication → Settings → Authorized domains
// 13. Agar GitHub Pages par host karo to woh domain add karo
//     (jaise: ahsanx123.github.io)