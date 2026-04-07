---
name: stop-dev
description: Stop the development server running on port 3000
disable-model-invocation: true
---

Stop the development server:

1. Find any process running on port 3000 with `lsof -ti:3000`
2. If a process is found, kill it with `kill $(lsof -ti:3000)`
3. If no process is found, inform the user that no server is running on port 3000
4. Verify the port is freed
