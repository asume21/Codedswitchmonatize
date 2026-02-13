---
description: Deploy the application to Railway
---

# Railway Deployment Workflow

## Prerequisites
- Railway CLI must be installed (`npm install -g @railway/cli`)
- Must be logged in (`railway login`)
- Must be linked to the project (`railway link`)

## Steps

1. Verify Railway CLI is authenticated and linked
// turbo
```
railway status
```

2. Check for uncommitted changes and commit if needed
```
git status
```

3. Build the project locally to verify no errors
```
npm run build
```

4. Deploy to Railway
```
railway up --detach
```

5. Monitor deployment logs to verify success
```
railway logs --tail 50
```

6. Check the service status
// turbo
```
railway status
```

## Rollback (if needed)
If the deployment fails, you can rollback:
```
railway rollback
```

## Environment Variables
To set environment variables:
```
railway variables set KEY=VALUE
```

To view current variables:
```
railway variables
```
