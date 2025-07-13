DROP TABLE IF EXISTS board_messages;
CREATE TABLE board_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id TEXT NOT NULL,
  content BLOB NOT NULL,
  created_at TEXT NOT NULL
);