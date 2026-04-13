-- Booking system: availability, overrides, and bookings
-- Enables public calendar booking via pellar.co.uk/book

-- Extend existing enums
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'booking';
ALTER TYPE timeline_event_type ADD VALUE IF NOT EXISTS 'booking_created';
ALTER TYPE timeline_event_type ADD VALUE IF NOT EXISTS 'booking_cancelled';

-- Weekly recurring availability windows
CREATE TABLE IF NOT EXISTS booking_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_booking_availability_active
  ON booking_availability(day_of_week, is_active)
  WHERE is_active = true;

CREATE TRIGGER booking_availability_set_updated_at
  BEFORE UPDATE ON booking_availability
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Date-specific overrides (block or add availability)
CREATE TABLE IF NOT EXISTS booking_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_date date NOT NULL,
  override_type text NOT NULL CHECK (override_type IN ('available', 'blocked')),
  start_time time,
  end_time time,
  reason text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX idx_booking_overrides_date
  ON booking_overrides(override_date);

CREATE TRIGGER booking_overrides_set_updated_at
  BEFORE UPDATE ON booking_overrides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Booking records
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  visitor_name text NOT NULL,
  visitor_email text NOT NULL,
  visitor_company text,
  visitor_message text,
  service_interest text,
  meeting_type text NOT NULL CHECK (meeting_type IN ('in_person', 'google_meet')),
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  google_event_id text,
  google_meet_link text,
  enrichment_status text DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending', 'running', 'complete', 'failed')),
  briefing_id uuid REFERENCES briefings(id) ON DELETE SET NULL,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_slot ON bookings(slot_start, slot_end);
CREATE INDEX idx_bookings_email ON bookings(lower(visitor_email));
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_deal ON bookings(deal_id);
CREATE UNIQUE INDEX idx_bookings_no_double ON bookings(slot_start) WHERE status = 'confirmed';

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS policies
ALTER TABLE booking_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Authenticated: full access
CREATE POLICY booking_availability_auth ON booking_availability
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY booking_overrides_auth ON booking_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY bookings_auth ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon: read availability + overrides, insert bookings
CREATE POLICY booking_availability_anon_read ON booking_availability
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY booking_overrides_anon_read ON booking_overrides
  FOR SELECT TO anon USING (true);
CREATE POLICY bookings_anon_insert ON bookings
  FOR INSERT TO anon WITH CHECK (true);

-- Seed: Mon-Fri 09:00-17:00
INSERT INTO booking_availability (day_of_week, start_time, end_time, is_active)
VALUES
  (1, '09:00', '17:00', true),
  (2, '09:00', '17:00', true),
  (3, '09:00', '17:00', true),
  (4, '09:00', '17:00', true),
  (5, '09:00', '17:00', true);
