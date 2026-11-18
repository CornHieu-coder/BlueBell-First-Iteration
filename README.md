# BlueBell scan status demo

BlueBell answers questions about scan times and report availability using fictional patient records. Staff transfers are simulated.

## Run locally

With Node.js 24 or later installed, open PowerShell in the project folder and run the following commands.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [the demo](http://127.0.0.1:5173/) and choose a case. You can browse without an API key.

For voice calls, set `OPENAI_API_KEY` in your server environment before starting the app. Choose **Start call**, allow microphone access, and ask “When will my patient be scanned?”
