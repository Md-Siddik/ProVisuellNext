// Production build into .next-e2e for the end-to-end tests, so it never
// collides with the .next folder a running `next dev` is using.
//   npm run build:e2e && npm run test:e2e
import { spawnSync } from "node:child_process"

const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-e2e" },
})
process.exit(result.status ?? 1)
