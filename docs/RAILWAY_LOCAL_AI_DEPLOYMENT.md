# Railway Deployment with Local AI

## 🚀 Deploy CodedSwitch with Packaged Local AI to Railway

This guide shows you how to deploy CodedSwitch with Ollama + Llama 3.1 packaged together, running entirely on Railway's servers.

---

## ✅ Benefits

- **$0 API costs** - No Grok/OpenAI fees
- **Fixed monthly cost** - $10-50/month (scales with usage)
- **Unlimited requests** - No rate limits
- **Your laptop stays free** - Everything runs on Railway
- **Automatic scaling** - Railway handles growth
- **Professional deployment** - Production-ready

---

## 📋 What Gets Deployed

**Docker Container includes:**
- CodedSwitch application
- Ollama (local AI runner)
- Llama 3.1 8B model (pre-downloaded, ~4.7GB)
- All dependencies

**Railway provides:**
- Server hardware (CPU/RAM)
- Auto-scaling
- Deployment automation
- Monitoring

---

## 🚀 Deployment Steps

### Step 1: Commit Docker Files

```bash
git checkout feature/ai-intelligence-system
git add Dockerfile.ollama docker-entrypoint.sh railway.json .dockerignore
git commit -m "Add Docker container with Ollama + Llama for Railway deployment"
git push origin feature/ai-intelligence-system
```

### Step 2: Configure Railway

1. Go to Railway dashboard: https://railway.app
2. Select your CodedSwitch project
3. Click **Settings**
4. Under **Build**, set:
   - **Builder:** Dockerfile
   - **Dockerfile Path:** `Dockerfile.ollama`
5. Under **Deploy**, set:
   - **Start Command:** `/usr/local/bin/docker-entrypoint.sh`
   - **Health Check Path:** `/api/health`
   - **Health Check Timeout:** 300 seconds

### Step 3: Set Environment Variables

In Railway, add these environment variables:

```env
# Use local AI (packaged in container)
USE_LOCAL_AI=true

# Ollama URL (localhost in container)
OLLAMA_URL=http://localhost:11434

# Model to use
OLLAMA_MODEL=llama3.1:8b

# Fallback to cloud if needed
FALLBACK_TO_CLOUD=true

# Your existing environment variables
XAI_API_KEY=your-key-here
REPLICATE_API_TOKEN=your-token-here
# ... etc
```

### Step 4: Deploy

```bash
# Railway will automatically deploy when you push to main
# Or manually trigger deployment in Railway dashboard
```

**First deployment takes 10-15 minutes** (downloads Llama model)

**Subsequent deployments:** 2-3 minutes (model is cached)

---

## 📊 Resource Requirements

### Minimum (Railway Starter):
- **RAM:** 4GB
- **CPU:** 2 cores
- **Disk:** 10GB
- **Cost:** ~$10-15/month
- **Performance:** 3-5 seconds per generation (CPU only)

### Recommended (Railway Pro):
- **RAM:** 8GB
- **CPU:** 4 cores
- **Disk:** 10GB
- **Cost:** ~$20-30/month
- **Performance:** 1-2 seconds per generation

### Optimal (Railway with GPU):
- **RAM:** 8GB
- **GPU:** Available on request
- **Disk:** 10GB
- **Cost:** ~$50-100/month
- **Performance:** 0.5-1 second per generation

---

## 🔍 Verify Deployment

### Check Logs:

**Successful startup:**
```
🚀 Starting CodedSwitch with Local AI...
🖥️ Starting Ollama service...
⏳ Waiting for Ollama to be ready...
📦 Verifying Llama 3.1 model...
✅ Llama 3.1 model is ready
🎵 Starting CodedSwitch server...
✅ Local AI (Ollama) is available
```

### Test Endpoint:

```bash
curl https://your-app.railway.app/api/astutely \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"style": "trap", "prompt": "dark aggressive beat"}'
```

**Response should include:**
```json
{
  "_aiSource": "local",
  "bpm": 140,
  "key": "Cm",
  ...
}
```

`"_aiSource": "local"` confirms local AI is being used!

---

## 💰 Cost Comparison

### Before (Cloud API):
- Railway: $10-15/month
- Grok API: $0.02/request
- **100 requests/day:** $60/month in API costs
- **1000 requests/day:** $600/month in API costs
- **Total:** $70-615/month

### After (Packaged Local AI):
- Railway: $10-50/month (scales with usage)
- Local AI: $0 (included)
- **Unlimited requests**
- **Total:** $10-50/month

**Savings:** $20-565/month depending on traffic

---

## 🔧 Troubleshooting

### "Model not found"

**Check logs for:**
```
⚠️ Model not found, downloading...
```

**This is normal on first deploy.** Wait 10-15 minutes for download.

### "Out of memory"

**Railway's free tier may not have enough RAM.**

**Solutions:**
1. Upgrade to Railway Pro ($20/month)
2. Use smaller model: Change `OLLAMA_MODEL=phi3:mini`
3. Enable cloud fallback (already configured)

### "Slow generation (5-10 seconds)"

**Railway is using CPU instead of GPU.**

**Solutions:**
1. This is normal for CPU-only
2. Request GPU instance from Railway support
3. Upgrade to higher tier

### "Local AI failed, using cloud fallback"

**This is expected behavior if:**
- Railway is restarting
- Out of resources
- Model loading

**Cloud API will handle requests until local AI is ready.**

---

## 🎛️ Advanced Configuration

### Use Different Model

**Edit `railway.json` or set environment variable:**
```env
# Smaller/faster model
OLLAMA_MODEL=phi3:mini

# Larger/better model (requires more RAM)
OLLAMA_MODEL=llama3.1:70b
```

### Disable Cloud Fallback

```env
# Only use local AI, fail if unavailable
FALLBACK_TO_CLOUD=false
```

**Warning:** Requests will fail if local AI is down

### Custom Dockerfile

**Edit `Dockerfile.ollama` to:**
- Use different base image
- Add more models
- Customize startup behavior

---

## 📈 Scaling Strategy

### Small Traffic (0-1000 requests/day):
- **Tier:** Railway Starter ($10-15/month)
- **Model:** llama3.1:8b
- **Performance:** Good

### Medium Traffic (1000-10,000 requests/day):
- **Tier:** Railway Pro ($20-30/month)
- **Model:** llama3.1:8b
- **Performance:** Great

### Large Traffic (10,000+ requests/day):
- **Tier:** Railway Pro with GPU ($50-100/month)
- **Model:** llama3.1:8b or multiple instances
- **Performance:** Excellent

**Railway auto-scales - you only pay for what you use!**

---

## 🔒 Security

### What Stays Private:
- ✅ All AI generation (on Railway's servers)
- ✅ User prompts (never sent to external APIs)
- ✅ Generated music (processed locally in container)

### What Goes to Cloud (if fallback enabled):
- ⚠️ Only when local AI fails
- ⚠️ Falls back to Grok API
- ⚠️ Can be disabled with `FALLBACK_TO_CLOUD=false`

---

## 🆘 Support

**Railway Issues:**
- Dashboard: https://railway.app
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

**Ollama Issues:**
- GitHub: https://github.com/ollama/ollama
- Docs: https://github.com/ollama/ollama/tree/main/docs

**CodedSwitch Issues:**
- Check Railway logs for errors
- Verify environment variables are set
- Test with cloud fallback enabled

---

## 🎯 Deployment Checklist

- [ ] Commit Docker files to feature branch
- [ ] Push to GitHub
- [ ] Configure Railway to use `Dockerfile.ollama`
- [ ] Set environment variables in Railway
- [ ] Deploy (wait 10-15 minutes for first deploy)
- [ ] Check logs for "✅ Llama 3.1 model is ready"
- [ ] Test API endpoint
- [ ] Verify `"_aiSource": "local"` in response
- [ ] Monitor Railway resource usage
- [ ] Upgrade tier if needed

**Done! Local AI running on Railway.** 🎉

---

**Version:** 1.0  
**Last Updated:** January 2026  
**Railway Deployment:** Docker + Ollama + Llama 3.1
