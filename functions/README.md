# Clean Madurai – Cloud Functions

## Forgot password (SMTP OTP)

Forgot password uses **SMTP** to send a 6-digit OTP to the user’s email. After they enter the OTP and a new password, their Firebase Auth password is updated.

### Configure SMTP (use .env)

SMTP is read from **environment variables** (e.g. a `.env` file). In the `functions` folder:

1. Copy the example file and add your values:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your@gmail.com
   SMTP_PASS=your-app-password
   ```

- **Gmail**: Use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password.
- **Port**: Use `587` for TLS or `465` for SSL.
- **Local/emulator**: `.env` is loaded automatically when you run the functions.
- **Production (deployed)**: Set the same variables in **Google Cloud Console** → Cloud Functions → select the function → Edit → **Environment variables** (add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`). Do not commit `.env`; keep it in `.gitignore`.

Optional: you can still use Firebase config instead of env:
```bash
firebase functions:config:set smtp.host="smtp.gmail.com" smtp.port="587" smtp.user="your@gmail.com" smtp.pass="your-app-password"
```
The code uses `.env` (or process.env) first, then falls back to Firebase config.

Redeploy after changing config (run from **project root** where `firebase.json` is):
```bash
cd clean-madurai
npm run build --prefix functions
firebase deploy --only functions
```

### SMTP not working?

1. **"SMTP is not configured"**  
   Create `functions/.env` from `functions/.env.example` and set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`. For production, set the same env vars in Google Cloud Console → Cloud Functions → your function → Edit → Environment variables.

2. **Gmail: "SMTP login failed" / "Invalid login"**  
   Do **not** use your normal Gmail password. Use an [App Password](https://support.google.com/accounts/answer/185833): Google Account → Security → 2-Step Verification → App passwords → generate one, then set `SMTP_PASS` to that 16-character password.

3. **Gmail: "Cannot reach SMTP server"**  
   Use `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=587`. Port 465 is also valid; avoid 25.

4. **Deployed function not sending**  
   Env vars in `.env` are **not** deployed. Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (and optionally `SMTP_PORT`) in the Cloud Function’s environment variables in Google Cloud Console, then redeploy.

5. **Test locally**  
   Run the emulator with your `.env` in place:  
   `cd functions && npm run build && npx firebase emulators:start --only functions`

### Flow

1. User opens **Forgot password** from login → enters email.
2. Frontend calls `requestPasswordResetOtp({ email })` → backend generates OTP, stores it in Firestore with expiry, sends OTP via SMTP.
3. User enters OTP + new password → frontend calls `verifyOtpAndResetPassword({ email, otp, newPassword })` → backend verifies OTP, updates Firebase Auth password, deletes OTP doc.
4. User is redirected to login and signs in with the new password.
