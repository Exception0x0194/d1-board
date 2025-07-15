DROP TABLE IF EXISTS board_attachment;
DROP TABLE IF EXISTS board_messages;

CREATE TABLE board_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id TEXT NOT NULL,
  content BLOB NOT NULL,
  created_at TEXT NOT NULL,
  has_attachment INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE board_attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES board_messages(id) ON DELETE CASCADE
);