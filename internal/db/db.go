package db

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"phuhx-dev747/home-gateway-stock/internal/models"
	"phuhx-dev747/home-gateway-stock/internal/utils"
)

var DB *sql.DB

func Init(path string) error {
	var err error
	DB, err = sql.Open("sqlite3", path)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS telemetry (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp INTEGER NOT NULL,
			cpu       REAL    NOT NULL,
			mem       REAL    NOT NULL,
			temp      REAL    NOT NULL,
			mem_used  INTEGER DEFAULT 0,
			mem_total INTEGER DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
	`)
	return err
}

func InsertTelemetry(d models.TelemetryData) {
	// Clean up records older than 24 hours (24 * 3600 * 1000 milliseconds)
	cutoff := time.Now().UnixMilli() - 24*60*60*1000
	if _, err := DB.Exec("DELETE FROM telemetry WHERE timestamp < ?", cutoff); err != nil {
		log.Printf("db cleanup error: %v", err)
	}

	_, err := DB.Exec(
		"INSERT INTO telemetry (timestamp, cpu, mem, temp, mem_used, mem_total) VALUES (?, ?, ?, ?, ?, ?)",
		d.Timestamp, d.CPU, d.Mem, d.Temp, d.MemUsed, d.MemTotal,
	)
	if err != nil {
		log.Printf("db insert error: %v", err)
	}
}

func QueryHistory(rangeStr string) ([]models.HistoryItem, error) {
	since := time.Now().UnixMilli() - utils.ParseRangeToSec(rangeStr)*1000
	rows, err := DB.Query(
		"SELECT timestamp, cpu, mem, temp, mem_used, mem_total FROM telemetry WHERE timestamp >= ? ORDER BY timestamp ASC",
		since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.HistoryItem
	for rows.Next() {
		var item models.HistoryItem
		if err := rows.Scan(&item.Timestamp, &item.CPU, &item.Mem, &item.Temp, &item.MemUsed, &item.MemTotal); err != nil {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}
