# Ansa booklet backend on Cloud Run

This container exposes the existing backend handlers at their current paths:

- `POST /api/company-profile`
- `POST /api/generate-booklet`
- `POST /api/parse-plan`
- `GET|POST /api/booklet-pipeline`
- `GET /healthz`

The frontend calls Cloud Run directly. During a Vercel build, the Vite plugin
rewrites static `fetch("/api/...")` calls to `VITE_BACKEND_API_URL`. Local Vite
development keeps the existing relative paths when that variable is absent.

Booklet `start` and `answer` requests from the Studio use NDJSON. The first
record contains the persisted run ID; subsequent records contain pipeline
events and independently persisted HTML page artifacts, followed by the blocked
or complete run. On completion, the backend composes those ordered HTML
artifacts and renders the final PDF. JSON responses remain available when the
request omits `stream: true`.

## Runtime configuration

Required Cloud Run environment:

- `OPENAI_API_KEY` from Secret Manager.
- `FIREBASE_PROJECT_ID=flux-ebfb0`.
- `FIREBASE_STORAGE_BUCKET=flux-ebfb0.firebasestorage.app`.
- `CORS_ALLOWED_ORIGINS`, comma-separated. Exact origins and wildcard entries
  are supported. Keep this limited to the production app, preview deployment
  pattern, and explicit local origins.

`/api/booklet-pipeline` requires a Firebase ID token in the `Authorization:
Bearer ...` header. Enable Anonymous authentication (or replace the frontend
provider with your normal Firebase sign-in) before using Booklet Studio. Every
thread, upload, run, status read, and answer is checked against the token UID.
Cloud Run remains invokable at the infrastructure layer because the application
performs this Firebase token verification itself.

Optional environment:

- `OPENAI_PLAN_MODEL` and `OPENAI_BOOKLET_CONTENT_MODEL`.
- `MAX_JSON_BODY_BYTES`, default 30 MiB inside the container. Cloud Run request
  limits still apply, so existing uploaded file IDs are preferable for large inputs.

Cloud Run provides `PORT`; the server binds it on `0.0.0.0` as required.

## Build and deploy commands

These commands are documentation only; they are not run automatically.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project flux-ebfb0

gcloud artifacts repositories create ansa \
  --project flux-ebfb0 \
  --location us-east1 \
  --repository-format docker

gcloud secrets create OPENAI_API_KEY --project flux-ebfb0 --replication-policy automatic
printf '%s' "$OPENAI_API_KEY" | gcloud secrets versions add OPENAI_API_KEY --project flux-ebfb0 --data-file=-

gcloud iam service-accounts create ansa-booklet-backend \
  --project flux-ebfb0 \
  --display-name "Ansa booklet backend"

export ANSA_RUNTIME_SA="ansa-booklet-backend@flux-ebfb0.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding flux-ebfb0 \
  --member "serviceAccount:${ANSA_RUNTIME_SA}" --role roles/datastore.user
gcloud storage buckets add-iam-policy-binding gs://flux-ebfb0.firebasestorage.app \
  --member "serviceAccount:${ANSA_RUNTIME_SA}" --role roles/storage.objectAdmin
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --project flux-ebfb0 \
  --member "serviceAccount:${ANSA_RUNTIME_SA}" --role roles/secretmanager.secretAccessor
gcloud iam service-accounts add-iam-policy-binding "$ANSA_RUNTIME_SA" \
  --project flux-ebfb0 \
  --member "serviceAccount:${ANSA_RUNTIME_SA}" --role roles/iam.serviceAccountTokenCreator

export ANSA_IMAGE="us-east1-docker.pkg.dev/flux-ebfb0/ansa/ansa-booklet-backend:$(git rev-parse --short HEAD)"
gcloud builds submit . \
  --project flux-ebfb0 \
  --config cloud-run/cloudbuild.yaml \
  --substitutions "_IMAGE=${ANSA_IMAGE}"

cp cloud-run/env.example.yaml cloud-run/env.yaml
# Replace YOUR_VERCEL_PROJECT before deploying.
gcloud run deploy ansa-booklet-backend \
  --project flux-ebfb0 \
  --region us-east1 \
  --image "$ANSA_IMAGE" \
  --allow-unauthenticated \
  --service-account "$ANSA_RUNTIME_SA" \
  --env-vars-file cloud-run/env.yaml \
  --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest \
  --cpu 2 \
  --memory 2Gi \
  --concurrency 2 \
  --timeout 900 \
  --max-instances 5 \
  --port 8080
```

The runtime service account needs Firestore read/write, Storage object access,
Secret Manager secret access, and permission to sign blobs because generated PDF
links use Cloud Storage signed URLs. Grant the narrow project/bucket roles your
deployment policy permits; `roles/datastore.user`, `roles/storage.objectAdmin`,
`roles/secretmanager.secretAccessor`, and service-account token creator on the
runtime identity cover the current implementation.

After deploy, get the permanent service URL and wire Vercel:

```bash
gcloud run services describe ansa-booklet-backend \
  --project flux-ebfb0 \
  --region us-east1 \
  --format 'value(status.url)'

npx vercel env add VITE_BACKEND_API_URL production
npx vercel env add VITE_BACKEND_API_URL preview
npx vercel --prod
```

Set the Vercel variable to the Cloud Run service URL without a trailing slash.
Vercel builds fail fast when the variable is missing, preventing a frontend from
being published with dead relative API routes.

## Local verification

```bash
./node_modules/.bin/esbuild cloud-run/server.ts \
  --bundle --platform=node --format=esm --target=node22 --packages=external \
  --sourcemap --outfile=cloud-run/dist/server.mjs

PORT=8080 CORS_ALLOWED_ORIGINS=http://localhost:5173 \
  node cloud-run/dist/server.mjs

curl --fail http://127.0.0.1:8080/healthz
curl -i -X OPTIONS http://127.0.0.1:8080/api/booklet-pipeline \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST'

curl -i http://127.0.0.1:8080/api/booklet-pipeline \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"action":"thread_status","threadId":"THREAD_ID"}'
```

The production smoke script also requires `FIREBASE_ID_TOKEN` for the user that
will own its temporary verification thread.
