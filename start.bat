@echo off
start cmd /k "cd server && node index.js"
start cmd /k "cd web_client && npm run dev"