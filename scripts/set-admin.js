// Run ONCE on your own computer:  node scripts/set-admin.js your@email.com
// Needs serviceAccount.json (Firebase console > Project settings > Service accounts > Generate key). NEVER upload that file.
const admin=require('../functions/node_modules/firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('./serviceAccount.json'))});
(async()=>{const u=await admin.auth().getUserByEmail(process.argv[2]);await admin.auth().setCustomUserClaims(u.uid,{admin:true});console.log('✅ admin granted to',u.email,'— sign out and in again')})();
