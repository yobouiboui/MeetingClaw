use std::path::Path;

use rusqlite::{params, Connection};

use crate::models::MeetingRecord;

pub struct HistoryStore {
    db_path: String,
}

impl HistoryStore {
    pub fn new(path: &Path) -> Result<Self, String> {
        let db_path = path.to_string_lossy().to_string();
        let store = Self { db_path };
        store.initialize()?;
        Ok(store)
    }

    pub fn load_history(&self, limit: usize) -> Result<Vec<MeetingRecord>, String> {
        let connection = self.connect()?;
        let mut statement = connection
            .prepare(
                "SELECT id, title, started_at, ended_at, summary, follow_up_email, transcript_preview
                 FROM meeting_history
                 ORDER BY ended_at DESC
                 LIMIT ?1",
            )
            .map_err(|err| err.to_string())?;

        let rows = statement
            .query_map(params![limit as i64], |row| {
                Ok(MeetingRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    started_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    summary: row.get(4)?,
                    follow_up_email: row.get(5)?,
                    transcript_preview: row.get(6)?,
                })
            })
            .map_err(|err| err.to_string())?;

        let mut history = Vec::new();
        for row in rows {
            history.push(row.map_err(|err| err.to_string())?);
        }

        Ok(history)
    }

    pub fn insert_meeting(&self, record: &MeetingRecord) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute(
                "INSERT OR REPLACE INTO meeting_history
                (id, title, started_at, ended_at, summary, follow_up_email, transcript_preview)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    record.id,
                    record.title,
                    record.started_at,
                    record.ended_at,
                    record.summary,
                    record.follow_up_email,
                    record.transcript_preview
                ],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn initialize(&self) -> Result<(), String> {
        let connection = self.connect()?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS meeting_history (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    follow_up_email TEXT NOT NULL,
                    transcript_preview TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_meeting_history_ended_at
                ON meeting_history(ended_at DESC);",
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn connect(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path).map_err(|err| err.to_string())
    }
}
