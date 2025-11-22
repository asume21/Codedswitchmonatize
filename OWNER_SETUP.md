# 👑 Owner Access Setup

To grant full access to the owner account on the production site without paying for credits, follow these steps:

## 1. Set Environment Variables

In your production environment (e.g., Railway, Vercel, Heroku), add the following environment variables:

### Identify the Owner
Set this to the email address of your account on the production site.
```env
OWNER_EMAIL=your-email@example.com
```

### Set Provider API Keys
Ensure these keys are valid and have credits/billing enabled. The app will use these keys for all generations initiated by the owner account.

```env
# Music Generation (Suno/MusicGen)
REPLICATE_API_TOKEN=r8_...

# Lyrics & Chat (Grok/XAI)
XAI_API_KEY=xai-...
```

## 2. How It Works

When you log in with the email matching `OWNER_EMAIL`:
1. The backend detects you are the owner.
2. **Credit checks are bypassed.** You can generate unlimited music/lyrics without buying credits on the site.
3. **Rate limits are bypassed.** You won't hit the standard user limits.
4. The backend uses the `REPLICATE_API_TOKEN` and `XAI_API_KEY` from the environment variables to pay the AI providers directly from your own account.

## 3. Verification

To verify you have owner access:
1. Log in to the production site with your owner email.
2. Try to generate a song.
3. Check the server logs (if accessible) for: `👑 Owner authenticated: your-email@example.com`

## Alternative: Owner Key Header

You can also bypass authentication checks programmatically (e.g., for testing) by sending a header:
```env
OWNER_KEY=your-secret-owner-key-here
```
Request Header:
```
x-owner-key: your-secret-owner-key-here
```
This treats the user as 'owner-user' and also bypasses credit checks.
