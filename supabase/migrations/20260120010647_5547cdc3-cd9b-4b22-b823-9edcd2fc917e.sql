-- Add status column to partner_profiles for approval workflow
ALTER TABLE partner_profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Add check constraint for valid status values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_profiles_status_check'
  ) THEN
    ALTER TABLE partner_profiles 
    ADD CONSTRAINT partner_profiles_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

-- Backfill existing partners: set status based on is_active
UPDATE partner_profiles SET status = 
  CASE WHEN is_active = true THEN 'approved' ELSE 'pending' END
WHERE status = 'pending' OR status IS NULL;