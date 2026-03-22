import type { ElectrobunConfig } from "electrobun"

export default {
  app: {
    name: "CR",
    identifier: "dev.cr.desktop",
    version: "0.1.0",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    mac: {
      icons: "icon.iconset",
    },
    win: {
      icon: "icon.png",
    },
    linux: {
      icon: "icon.png",
    },
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
} satisfies ElectrobunConfig
