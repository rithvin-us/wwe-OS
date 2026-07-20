import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Frontend only. The Python backend (platform/) — including its virtualenv
    // and any static assets shipped by pip packages — is never linted here.
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "**/.next/",
      "database/",
      "platform/**",
      "**/.venv/**",
      "**/staticfiles/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
