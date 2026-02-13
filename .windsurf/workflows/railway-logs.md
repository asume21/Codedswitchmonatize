---
description: Check Railway deployment logs and debug issues
---

# Railway Logs & Debugging Workflow

## Steps

1. Verify Railway connection
// turbo
```
railway status
```

2. Fetch recent logs (last 100 lines)
// turbo
```
railway logs --tail 100
```

3. If errors are found in the logs, analyze them and suggest fixes

4. If a fix is applied and committed, redeploy:
```
railway up --detach
```

5. Verify the fix by checking logs again:
// turbo
```
railway logs --tail 50
```
