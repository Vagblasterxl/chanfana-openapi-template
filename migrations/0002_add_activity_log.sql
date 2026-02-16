-- Activity log for tracking GitHub deploys, syncs, and other automated actions
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at DATETIME NOT NULL
);
