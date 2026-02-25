
-- Add document_url to customer_profiles for PDF uploads
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS document_url text;

-- Add document_url to seller_profiles for PDF uploads  
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS document_url text;

-- Create storage bucket for user documents (PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow admins to view all documents
CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-documents' AND public.has_role(auth.uid(), 'admin'));

-- Allow users to delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
