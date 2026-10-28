# Repository workflow

These instructions apply to every AI coding agent working in this repository.

## Required deployment workflow

For every requested code or UI change:

1. Preserve existing user work. Inspect `git status` before editing, do not discard unrelated changes, and stage only files or hunks that belong to the current task.
2. Implement the change and verify it in proportion to its risk. The standard checks are:
   - `npm run lint`
   - `npx tsx --test src/game/*.test.ts` for gameplay changes
   - `npm run build`
3. Commit the task-related changes directly to the `main` branch with a clear commit message.
4. Push the commit with `git push origin main`. This GitHub push is the production deployment mechanism; do not start a local development server unless the user explicitly asks for one.
5. Wait for the Vercel status check on the pushed commit to reach `success`. If it fails, inspect the deployment/build logs, fix the issue, run the checks again, commit, and push the fix.
6. In the final response, always include:
   - the production URL: https://war-of-planets.vercel.app/
   - the deployed commit's short SHA
   - the verification and Vercel deployment result

Never commit generated videos, screenshots, prototype artifacts, credentials, or unrelated local files unless the user explicitly places them in scope.

## Production deployment contract

- Repository: `https://github.com/yigitefeoktar/war-of-planets.git`; release branch: `main`.
- Vercel project: `war-of-planets` under `yigits-projects-96bf526b`.
- Production URL: https://war-of-planets.vercel.app/
- Frontend: Vite; build with `npm run build`, output directory `dist`.
- Deployment is triggered by `git push origin main`. Verify the `Vercel` commit status on that exact SHA, then check the public production site. GitHub deployment statuses provide deployment URLs and status evidence when the Vercel connector is unavailable.
- No `deployment.json` or backend contract is configured. Deploy only the frontend; do not install, start, or expose a backend or reuse another game's service.
- Use the checks listed above before pushing. Inspect failed checks and deployment logs, repair the issue, and push a normal follow-up commit. Never force-push or roll back unrelated user work.
- Do not enable Google Cloud billing or automatic deployment triggers; this workflow uses Vercel.
- The user resumed normal deployments on 2026-10-28. Earlier local-only instructions for Chapter 2 are superseded. Follow this workflow for future requested code and UI changes.
