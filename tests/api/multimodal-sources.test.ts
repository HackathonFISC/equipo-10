import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDatabase, type DatabaseFixture } from "../support/database-fixture";
import { startAuthFixture, type AuthFixture } from "../support/auth-fixture";
import { createApp } from "../../apps/api/src/app";
import { IdentityService } from "../../apps/api/src/modules/identity/identity.service";
import { ProfileService } from "../../apps/api/src/modules/profile/profile.service";
import { createVerifyToken } from "../../apps/api/src/security/auth";
import type { Hono } from "hono";
import type { AppEnv } from "../../apps/api/src/app";

describe("D2-C Integration: Multimodal Source Ingestion (PDF, Image, Audio) & Magic Bytes Validation", () => {
  let auth: AuthFixture;
  let dbFixture: DatabaseFixture;
  let app: Hono<AppEnv>;
  let draftId: string;
  let pdfSourceId: string;

  beforeAll(async () => {
    auth = startAuthFixture(0);
    dbFixture = await setupTestDatabase();

    const verifyToken = createVerifyToken({ ...dbFixture.config, supabaseUrl: auth.url });
    const identityService = new IdentityService(dbFixture.db);
    const profileService = new ProfileService(dbFixture.db);

    app = createApp({
      identityService,
      profileService,
      verifyToken,
      allowedOrigins: dbFixture.config.allowedOrigins,
    });

    // 1. Bootstrap User A
    const resA = await app.request("/api/v1/me", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resA.status).toBe(200);

    // 2. Ensure Profile
    const profA = await app.request("/api/v1/me/candidate-profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${auth.tokens.a}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(profA.status).toBe(200);

    // 3. Initialize Draft (Revision 1)
    const draftRes = await app.request("/api/v1/me/candidate-profile/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.tokens.a}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "d2c-init-draft-key-12345678",
      },
      body: JSON.stringify({ base_version_id: null }),
    });
    expect(draftRes.status).toBe(201);
    const draftJson = await draftRes.json();
    draftId = draftJson.data.id;
  });

  afterAll(async () => {
    if (auth) auth.stop();
    if (dbFixture) await dbFixture.close();
  });

  // D2-C1: PDF Validation & Ingestion
  describe("D2-C1 PDF Documents", () => {
    it("rejects non-PDF files that lack %PDF- magic bytes with 415", async () => {
      const fakePdfContent = Buffer.from("Este es un archivo de texto simple simulando ser PDF");
      const formData = new FormData();
      formData.append("file", new Blob([fakePdfContent], { type: "application/pdf" }), "curriculum.pdf");
      formData.append("kind", "pdf");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "fake-pdf-magic-bytes-key-01",
        },
        body: formData,
      });

      expect(res.status).toBe(415);
      const body = await res.json();
      expect(body.error.code).toBe("UNSUPPORTED_SOURCE");
    });

    it("rejects PDF files exceeding 10 MiB with 413", async () => {
      // 10 MiB + 100 bytes buffer with %PDF- header
      const largePdf = Buffer.alloc(10 * 1024 * 1024 + 100);
      largePdf.write("%PDF-1.4\n", 0, "utf-8");

      const formData = new FormData();
      formData.append("file", new Blob([largePdf], { type: "application/pdf" }), "oversized.pdf");
      formData.append("kind", "pdf");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "oversized-pdf-key-1234567890",
        },
        body: formData,
      });

      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error.code).toBe("SOURCE_TOO_LARGE");
    });

    it("accepts valid PDF with %PDF- header, extracts fragments and saves source", async () => {
      const validPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 100 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Experiencia como auxiliar contable y manejo de Excel) Tj\nET\nendstream\nendobj\nxref\n0 5\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
      );

      const formData = new FormData();
      formData.append("file", new Blob([validPdf], { type: "application/pdf" }), "cv_oficial.pdf");
      formData.append("kind", "pdf");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "valid-pdf-upload-key-123456",
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.kind).toBe("PDF");
      expect(body.data.status).toBe("READY");
      expect(body.data.media_type).toBe("application/pdf");
      expect(body.data.fragments_count).toBe(1);
      expect(body.data.fragments[0].page).toBe(1);
      expect(body.data.fragments[0].text).toContain("auxiliar contable");
      pdfSourceId = body.data.id;
    });
  });

  // D2-C2: Image Validation & Ingestion
  describe("D2-C2 Images (JPEG / PNG / WebP)", () => {
    it("rejects files without valid image magic bytes with 415", async () => {
      const fakeImage = Buffer.from("Not an image file contents");
      const formData = new FormData();
      formData.append("file", new Blob([fakeImage], { type: "image/jpeg" }), "photo.jpg");
      formData.append("kind", "image");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "fake-image-magic-bytes-key-01",
        },
        body: formData,
      });

      expect(res.status).toBe(415);
      const body = await res.json();
      expect(body.error.code).toBe("UNSUPPORTED_SOURCE");
    });

    it("accepts valid JPEG with FF D8 FF header", async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const formData = new FormData();
      formData.append("file", new Blob([jpegBuffer], { type: "image/jpeg" }), "certificado.jpg");
      formData.append("kind", "image");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "valid-jpeg-upload-key-12345",
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.kind).toBe("IMAGE");
      expect(body.data.media_type).toBe("image/jpeg");
      expect(body.data.status).toBe("READY");
      expect(body.data.fragments.length).toBe(1);
    });

    it("accepts valid PNG with 89 50 4E 47 header", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const formData = new FormData();
      formData.append("file", new Blob([pngBuffer], { type: "image/png" }), "diploma.png");
      formData.append("kind", "image");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "valid-png-upload-key-123456",
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.kind).toBe("IMAGE");
      expect(body.data.media_type).toBe("image/png");
    });
  });

  // D2-C3: Audio Validation & Ingestion
  describe("D2-C3 Audio (WAV / MP3 / M4A)", () => {
    it("rejects files without valid audio header with 415", async () => {
      const fakeAudio = Buffer.from("Not an audio file header");
      const formData = new FormData();
      formData.append("file", new Blob([fakeAudio], { type: "audio/wav" }), "grabacion.wav");
      formData.append("kind", "audio");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "fake-audio-header-key-12345",
        },
        body: formData,
      });

      expect(res.status).toBe(415);
      const body = await res.json();
      expect(body.error.code).toBe("UNSUPPORTED_SOURCE");
    });

    it("accepts valid WAV file with RIFF....WAVE header and stores timestamped fragments", async () => {
      const wavHeader = Buffer.alloc(44);
      wavHeader.write("RIFF", 0, "ascii");
      wavHeader.writeUInt32LE(36, 4);
      wavHeader.write("WAVE", 8, "ascii");
      wavHeader.write("fmt ", 12, "ascii");
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20); // PCM
      wavHeader.writeUInt16LE(1, 22); // mono
      wavHeader.writeUInt32LE(16000, 24); // sample rate
      wavHeader.write("data", 36, "ascii");
      wavHeader.writeUInt32LE(0, 40);

      const formData = new FormData();
      formData.append("file", new Blob([wavHeader], { type: "audio/wav" }), "audio_relato.wav");
      formData.append("kind", "audio");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "valid-wav-upload-key-123456",
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.kind).toBe("AUDIO");
      expect(body.data.media_type).toBe("audio/wav");
      expect(body.data.status).toBe("READY");
      expect(body.data.fragments.length).toBe(1);
      expect(body.data.fragments[0].start_millis).toBe(0);
      expect(body.data.fragments[0].end_millis).toBeGreaterThan(0);
    });

    it("accepts valid MP3 file with ID3 header", async () => {
      const mp3Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const formData = new FormData();
      formData.append("file", new Blob([mp3Header], { type: "audio/mpeg" }), "audio_test.mp3");
      formData.append("kind", "audio");

      const res = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "valid-mp3-upload-key-123456",
        },
        body: formData,
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.kind).toBe("AUDIO");
      expect(body.data.media_type).toBe("audio/mpeg");
    });
  });

  // Source Withdrawal and Blocking
  describe("Source Withdrawal", () => {
    it("withdraws source successfully and blocks it from future interpretation grants", async () => {
      // 1. Withdraw the PDF source created earlier
      const resWithdraw = await app.request(`/api/v1/me/profile-sources/${pdfSourceId}/withdrawals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "withdraw-pdf-source-key-123",
        },
        body: JSON.stringify({ reason: "Documento desactualizado por el postulante" }),
      });

      expect(resWithdraw.status).toBe(200);
      const withdrawBody = await resWithdraw.json();
      expect(withdrawBody.data.status).toBe("WITHDRAWN");

      // 2. Fetch the source via GET and verify it reflects WITHDRAWN
      const getRes = await app.request(`/api/v1/me/profile-sources/${pdfSourceId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${auth.tokens.a}` },
      });
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.data.status).toBe("WITHDRAWN");

      // 3. Attempt to create an interpretation grant with the withdrawn source -> 422
      const grantRes = await app.request("/api/v1/me/profile-interpretation-grants", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "grant-withdrawn-source-key-1",
        },
        body: JSON.stringify({
          source_refs: [{ id: pdfSourceId, version: 1 }],
          draft_revision: 1,
          purpose: "profile_interpretation",
          provider: "vertex",
        }),
      });

      expect(grantRes.status).toBe(422);
      const grantBody = await grantRes.json();
      expect(grantBody.error.code).toBe("PROCESSING_GRANT_REQUIRED");
    });

    it("allows uploading identical file content multiple times with distinct storage keys and source ids", async () => {
      const validPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
        "4 0 obj\n<< /Length 55 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Desarrollador Fullstack) Tj\nET\nendstream\nendobj\n" +
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n" +
        "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n500\n%%EOF"
      );

      // Primer upload con idempotency key 1
      const formData1 = new FormData();
      formData1.append("file", new Blob([validPdf], { type: "application/pdf" }), "cv1.pdf");
      formData1.append("kind", "pdf");

      const res1 = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "repeated-pdf-upload-key-1",
        },
        body: formData1,
      });
      expect(res1.status).toBe(201);
      const body1 = await res1.json();

      // Segundo upload del MISMO contenido con nueva idempotency key 2
      const formData2 = new FormData();
      formData2.append("file", new Blob([validPdf], { type: "application/pdf" }), "cv1-reupload.pdf");
      formData2.append("kind", "pdf");

      const res2 = await app.request("/api/v1/me/profile-sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.tokens.a}`,
          "Idempotency-Key": "repeated-pdf-upload-key-2",
        },
        body: formData2,
      });
      expect(res2.status).toBe(201);
      const body2 = await res2.json();

      // Tienen el mismo sha256 pero distinto id de fuente
      expect(body1.data.sha256).toBe(body2.data.sha256);
      expect(body1.data.id).not.toBe(body2.data.id);
    });
  });
});
