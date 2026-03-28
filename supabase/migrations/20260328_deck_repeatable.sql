-- Add repeatable column to decks table
ALTER TABLE decks
ADD COLUMN repeatable BOOLEAN NOT NULL DEFAULT TRUE;
