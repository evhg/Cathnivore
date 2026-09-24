import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cathnivore.game',
  appName: 'Cathnivore',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
