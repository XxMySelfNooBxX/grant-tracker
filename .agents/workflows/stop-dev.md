---
description: Stop the development servers
---

This workflow stops both the React frontend and the Node.js backend running for local development.

// turbo
1. Stop the frontend and backend servers by terminating processes on ports 3000 and 3001. Run the command `lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true` in any directory.
