import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
 
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // CSP temporarily disabled for Firebase Functions testing
  // server: {
  //   headers: {
  //     "Content-Security-Policy":
  //       "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com; connect-src 'self' http://localhost:* ws: wss: https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net https://us-central1-dairy-69.cloudfunctions.net;",
  //   },
  // },
});
