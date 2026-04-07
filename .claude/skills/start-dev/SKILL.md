---
name: start-dev
description: Start the development server on port 3000
disable-model-invocation: true
---

Start the development server:

1. First check if port 3000 is already in use with `lsof -ti:3000`
2. If a process is already running on port 3000, inform the user and do not start another server
3. If port 3000 is free, run `npm run dev` in the background
4. Confirm the server is starting on http://localhost:3000
