export interface TrainingCertificateView {
  id: string;
  completion_id: string;
  original_filename: string;
  content_type: 'application/pdf';
  size_bytes: number;
  sha256: string;
  recorded_at: string;
}
