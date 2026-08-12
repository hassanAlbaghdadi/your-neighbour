// next/server-only throws when imported outside Next's own bundler (it
// relies on webpack's react-server resolve condition to swap itself for a
// no-op). Vitest runs on Vite, not Next's bundler, so we alias it here.
export {};
