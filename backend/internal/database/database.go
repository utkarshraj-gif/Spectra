package database

import (
	"database/sql"
	"fmt"
	"log"
)

type DB struct {
	Conn *sql.DB
}

func Connect(databaseURL string) (*DB, error) {
	log.Printf("Connecting to database at %s...", databaseURL)
	// Database connection initialization
	// In production, register pgx or pq driver
	return &DB{}, nil
}

func (d *DB) Ping() error {
	if d.Conn == nil {
		return fmt.Errorf("database connection not established")
	}
	return d.Conn.Ping()
}
