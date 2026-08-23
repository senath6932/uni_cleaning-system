/** @type {import('vitest').UserConfigExport} */
module.exports = {
  test: {
    environment: "node",
    pool: "threads",
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
};
