-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the stores table
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT NOT NULL,
  address TEXT NOT NULL,
  maps_url TEXT NOT NULL,
  place_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create the store_images table
CREATE TABLE store_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create the image_analysis table
CREATE TABLE image_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID REFERENCES store_images(id) ON DELETE CASCADE,
  detected_objects JSONB,
  appliance_found BOOLEAN DEFAULT FALSE,
  analysis_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_analysis ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view data
CREATE POLICY "Allow authenticated to select stores" ON stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated to select store_images" ON store_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated to select image_analysis" ON image_analysis FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert data (optional, but handled safely via Next.js service role normally. Provided for safety)
CREATE POLICY "Allow authenticated to insert stores" ON stores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to insert store_images" ON store_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to insert image_analysis" ON image_analysis FOR INSERT TO authenticated WITH CHECK (true);
