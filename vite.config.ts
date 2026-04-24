/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Use the repo name as the base path when building for GitHub Pages.
  // The GITHUB_REPOSITORY env var is set automatically in GitHub Actions
  // (format: "owner/repo"). In local dev it is undefined, so base stays '/'.
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
