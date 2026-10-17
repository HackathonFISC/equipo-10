import assert from "node:assert/strict";
import { makePublicEnv } from "./prepare-web-env.mjs";

const cases = [
  {
    name: "valid publishable key and default API url",
    run() {
      const env = {
        SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
      };
      const content = makePublicEnv(env);
      assert.equal(
        content,
        'VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co"\nVITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_validToken123_"\nVITE_API_URL="http://127.0.0.1:3001"\n'
      );
    },
  },
  {
    name: "valid legacy anon jwt",
    run() {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ role: "anon", exp: 1999999999 })).toString("base64url");
      const token = `${header}.${payload}.signature_bytes`;
      const env = {
        SUPABASE_URL: "https://myprojectref12345.supabase.co/",
        SUPABASE_PUBLISHABLE_KEY: token,
        VITE_API_URL: "https://api.example.com",
      };
      const content = makePublicEnv(env);
      assert.equal(
        content,
        `VITE_SUPABASE_URL="https://myprojectref12345.supabase.co"\nVITE_SUPABASE_PUBLISHABLE_KEY="${token}"\nVITE_API_URL="https://api.example.com"\n`
      );
    },
  },
  {
    name: "rejects service_role JWT",
    run() {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
      const token = `${header}.${payload}.signature_bytes`;
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: token,
          }),
        /INVALID_PUBLISHABLE_KEY/
      );
    },
  },
  {
    name: "rejects sb_secret_ key",
    run() {
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_secret_secretToken123",
          }),
        /INVALID_PUBLISHABLE_KEY/
      );
    },
  },
  {
    name: "rejects arbitrary unknown token e.g. Google key or malformed JWT",
    run() {
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "AIzaSyD-randomgoogleapikey",
          }),
        /INVALID_PUBLISHABLE_KEY/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "part1.notbase64json.part3",
          }),
        /INVALID_PUBLISHABLE_KEY/
      );
    },
  },
  {
    name: "rejects CRLF and newline in key or url",
    run() {
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co\n",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
          }),
        /INVALID_SUPABASE_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_\r\n",
          }),
        /INVALID_PUBLISHABLE_KEY/
      );
    },
  },
  {
    name: "rejects invalid Supabase host, protocol, path, credential, query, or hash",
    run() {
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
          }),
        /INVALID_SUPABASE_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://user:pass@abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
          }),
        /INVALID_SUPABASE_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co/extra/path",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
          }),
        /INVALID_SUPABASE_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co?query=1",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
          }),
        /INVALID_SUPABASE_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://not-supabase-domain.com",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
          }),
        /INVALID_SUPABASE_URL/
      );
    },
  },
  {
    name: "rejects invalid VITE_API_URL with credentials, path, query, hash, or bad protocol",
    run() {
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
            VITE_API_URL: "http://user:pass@127.0.0.1:3001",
          }),
        /INVALID_API_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
            VITE_API_URL: "http://127.0.0.1:3001/api/v1",
          }),
        /INVALID_API_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
            VITE_API_URL: "ftp://127.0.0.1:3001",
          }),
        /INVALID_API_URL/
      );
      assert.throws(
        () =>
          makePublicEnv({
            SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
            VITE_API_URL: "http://127.0.0.1:3001\n",
          }),
        /INVALID_API_URL/
      );
    },
  },
  {
    name: "injected extra DATABASE_URL, DIRECT_URL, and VITE_PRIVATE do not appear in output",
    run() {
      const env = {
        SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_validToken123_",
        DATABASE_URL: "postgresql://runtime:secret@localhost:5432/db",
        DIRECT_URL: "postgresql://owner:secret@localhost:5432/db",
        VITE_PRIVATE_SECRET: "supersecret",
        VITE_EXTRA_FLAG: "true",
      };
      const content = makePublicEnv(env);
      assert.equal(content.includes("DATABASE_URL"), false);
      assert.equal(content.includes("DIRECT_URL"), false);
      assert.equal(content.includes("VITE_PRIVATE_SECRET"), false);
      assert.equal(content.includes("VITE_EXTRA_FLAG"), false);
      assert.equal(content.includes("supersecret"), false);
      const lines = content.trim().split("\n");
      assert.equal(lines.length, 3);
      const keys = lines.map((l) => l.split("=")[0]);
      assert.deepEqual(keys, [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "VITE_API_URL",
      ]);
    },
  },
  {
    name: "quoted escaping using JSON.stringify for safe values",
    run() {
      const env = {
        SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_token-with-dash_and_underscore",
      };
      const content = makePublicEnv(env);
      assert.ok(content.includes('VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co"'));
      assert.ok(
        content.includes('VITE_SUPABASE_KEY="') === false
      );
      assert.ok(
        content.includes('VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_token-with-dash_and_underscore"')
      );
    },
  },
];

for (const c of cases) {
  c.run();
}

const testNames = cases.map((c) => c.name);
console.log(`Passed ${testNames.length} test cases: ${testNames.join(", ")}`);
