-- ============================================================
-- Migration v2: Multi-Council Support
-- Run this on an existing tc_events database.
-- Safe to run multiple times (idempotent via IF NOT EXISTS / IGNORE).
-- ============================================================

-- 1. Councils table
CREATE TABLE IF NOT EXISTS councils (
  council_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  slug         VARCHAR(100) NOT NULL UNIQUE,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_councils_slug (slug),
  INDEX idx_councils_active (is_active)
) ENGINE=InnoDB;

-- 2a. Widen the ENUM to include all old AND new values so existing data is preserved
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','organizer','member','super_admin','council_lead') NOT NULL DEFAULT 'member';

-- 2b. Migrate existing role values to new names
UPDATE users SET role = 'super_admin'  WHERE role = 'admin';
UPDATE users SET role = 'council_lead' WHERE role = 'organizer';

-- 2c. Narrow the ENUM to final set (old values are now gone from data)
ALTER TABLE users
  MODIFY COLUMN role ENUM('super_admin','council_lead','member') NOT NULL DEFAULT 'member';

-- 2d. Add council_id to users (MySQL 8 has no ADD COLUMN IF NOT EXISTS, so guard via information_schema)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'council_id' AND TABLE_SCHEMA = DATABASE()
);
SET @sql_col = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN council_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- 2e. Add is_active to users if not already present
SET @col2_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active' AND TABLE_SCHEMA = DATABASE()
);
SET @sql_col2 = IF(@col2_exists = 0,
  'ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE',
  'SELECT 1'
);
PREPARE stmt_col2 FROM @sql_col2;
EXECUTE stmt_col2;
DEALLOCATE PREPARE stmt_col2;

-- 2g. Index on users.council_id if not already present
SET @idx_u_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE INDEX_NAME = 'idx_users_council' AND TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE()
);
SET @sql_idx_u = IF(@idx_u_exists = 0,
  'ALTER TABLE users ADD INDEX idx_users_council (council_id)',
  'SELECT 1'
);
PREPARE stmt_idx_u FROM @sql_idx_u;
EXECUTE stmt_idx_u;
DEALLOCATE PREPARE stmt_idx_u;

-- 2f. Add the foreign key (may fail with duplicate key name on re-run — safely ignore)
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_NAME = 'fk_users_council'
    AND TABLE_NAME = 'users'
    AND TABLE_SCHEMA = DATABASE()
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_council FOREIGN KEY (council_id) REFERENCES councils(council_id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add council_id to events if not already present
SET @col3_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_NAME = 'events' AND COLUMN_NAME = 'council_id' AND TABLE_SCHEMA = DATABASE()
);
SET @sql_col3 = IF(@col3_exists = 0,
  'ALTER TABLE events ADD COLUMN council_id INT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE stmt_col3 FROM @sql_col3;
EXECUTE stmt_col3;
DEALLOCATE PREPARE stmt_col3;

-- 3a. Add the FK for events
SET @fk2_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_NAME = 'fk_events_council'
    AND TABLE_NAME = 'events'
    AND TABLE_SCHEMA = DATABASE()
);

SET @sql2 = IF(@fk2_exists = 0,
  'ALTER TABLE events ADD CONSTRAINT fk_events_council FOREIGN KEY (council_id) REFERENCES councils(council_id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3b. Add index if not present
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE INDEX_NAME = 'idx_events_council'
    AND TABLE_NAME = 'events'
    AND TABLE_SCHEMA = DATABASE()
);

SET @sql3 = IF(@idx_exists = 0,
  'ALTER TABLE events ADD INDEX idx_events_council (council_id)',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
