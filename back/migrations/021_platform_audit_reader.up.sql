ALTER TABLE platform_audit ADD COLUMN reader_id UUID REFERENCES readers(id) ON DELETE SET NULL;
