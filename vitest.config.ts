/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    exclude: ["**/tmp/*"]
    // ... Specify options here.
  },
})