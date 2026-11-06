CREATE TABLE admin_accounts (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES admin_accounts(username), user_id TEXT NOT NULL, expires INTEGER NOT NULL, credential_version TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires);
--> statement-breakpoint
CREATE TABLE login_attempts (user_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);
