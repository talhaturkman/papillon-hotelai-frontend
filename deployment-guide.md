# 🚀 Papillon AI - Google Cloud Run Deployment Guide

## 📋 Prerequisites
- Google Cloud Console access
- Project: `gen-lang-client-0930707875`
- Custom domain: `talhaturkman.com`

## 🌐 Planned Infrastructure
- **Backend API:** `api.talhaturkman.com` (Google Cloud Run)
- **Frontend:** `ai.talhaturkman.com` (Firebase Hosting)

## 🔧 Cloud Run Deployment Steps

### 1. Access Cloud Run Console
- URL: https://console.cloud.google.com/run?project=gen-lang-client-0930707875
- Click "CREATE SERVICE"

### 2. Container Configuration
- **Service name:** `papillon-backend`
- **Region:** `us-central1` 
- **Container Port:** `8080`
- **Authentication:** Allow unauthenticated invocations
- **Memory:** `1 GiB`
- **CPU:** `1`

### 3. Environment Variables
```bash
NODE_ENV=production
GOOGLE_CLOUD_API_KEY=AIzaSyBiqxFAooCoJX1y-_IgDbVAtoaZ2SVKmxk
FIREBASE_PROJECT_ID=gen-lang-client-0930707875
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@gen-lang-client-0930707875.iam.gserviceaccount.com
DOCUMENT_AI_PROJECT_ID=gen-lang-client-0930707875
DOCUMENT_AI_LOCATION=us
DOCUMENT_AI_PROCESSOR_ID=fe5f1775f1ca2990
GEMINI_MODEL=gemini-2.0-flash-exp
SUPPORTED_LANGUAGES=tr,en,de,ru
SUPPORTED_HOTELS=Belvil,Zeugma,Ayscha
```

### 4. Source Configuration
- **Deploy from:** Existing container image or Source Repository
- **If using source:** GitHub repository with Dockerfile

### 5. Domain Mapping (After deployment)
1. Go to "Manage Custom Domains" in Cloud Run
2. Add domain: `api.talhaturkman.com`
3. Update DNS records in domain provider
4. Add SSL certificate

## 🔗 Domain Configuration
After Cloud Run deployment, you'll need to:
1. Get the Cloud Run service URL
2. Configure DNS A/CNAME records
3. Set up SSL certificate
4. Update frontend to use new API URL

## 📱 Frontend Update
Once backend is deployed, update:
- `client/.env` with new API URL
- Rebuild and redeploy to Firebase

## ✅ Verification
- Backend health check: `https://api.talhaturkman.com/api/health`
- Frontend access: `https://ai.talhaturkman.com`
- Cross-origin requests working
- Mobile access functional 