import { defineConfig } from 'prisma/config';

// Validate/generate/diff-from-empty work without connecting to any database.
// A missing migration URL must never silently fall back to DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DIRECT_URL || 'postgresql://not-configured@127.0.0.1:1/not_configured',
  },
});
