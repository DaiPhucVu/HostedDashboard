# Handyman Admin Dashboard

React interface for reviewing Firebase jobs, inspecting AI triage, comparing
provider recommendations, and confirming or cancelling assignments.

## Run

Start the local AI service first, then:

```bash
npm ci
REACT_APP_LOCAL_AI_SERVICE_URL=http://127.0.0.1:8080 npm start
```

Open `http://127.0.0.1:3000/job-management`.

The default mode uses the repository's Firebase configuration. Set
`REACT_APP_USE_LOCAL_FIXTURES=true` only for an isolated UI demonstration.

## Test

```bash
npm test -- --watchAll=false
npm run build
```
