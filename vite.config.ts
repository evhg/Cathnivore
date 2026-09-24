import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function versionFile(): Plugin {
  return {
    name: 'cathnivore-version-file',
    closeBundle() {
      let commit = 'unknown'
      try {
        commit = execSync('git rev-parse HEAD').toString().trim()
      } catch {
        // no git info available; keep 'unknown'
      }
      const payload = {
        commit,
        buildTime: new Date().toISOString(),
      }
      writeFileSync(resolve(import.meta.dirname, 'dist/version.json'), JSON.stringify(payload, null, 2))
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  build: {
    outDir: 'dist',
  },
})
