-- ============================================================
-- Migration v3: Council Lead registration + Super Admin approval
-- Run this on an existing tc_events database.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- Self-registration requests.
-- Members are created immediately and never land here; only people asking to
-- become a Council Lead are stored as a pending request until a Super Admin
-- approves (which also creates the proposed council) or rejects them.
CREATE TABLE IF NOT EXISTS registration_requests (
  request_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  requested_role ENUM('member','council_lead') NOT NULL DEFAULT 'council_lead',
  council_name   VARCHAR(150) NOT NULL,
  council_slug   VARCHAR(100) NOT NULL,
  department     VARCHAR(100) NULL,
  message        TEXT NULL,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by    INT UNSIGNED NULL,
  reviewed_at    TIMESTAMP NULL,
  review_note    VARCHAR(255) NULL,
  CONSTRAINT fk_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_req_status (status),
  INDEX idx_req_email (email)
) ENGINE=InnoDB;
