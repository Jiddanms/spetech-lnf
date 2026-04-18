
-- Spetech Lost and Found - Database Schema
-- Table: users (Untuk manajemen akun & login)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, -- Akan disimpan dalam bentuk hash/plain (disesuaikan di backend)
    role TEXT DEFAULT 'user', -- 'admin' atau 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: locations (Untuk sistem QR Lokasi)
CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    qr_image_url TEXT,
    qr_code_payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: items (Jantung dari sistem Lost & Found)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'lost' (kehilangan) atau 'found' (penemuan)
    item_name TEXT NOT NULL,
    description TEXT,
    location_name TEXT NOT NULL, -- Diisi otomatis dari QR atau manual
    reporter_name TEXT NOT NULL, -- Nama penemu/pelapor
    owner_name TEXT, -- Khusus 'lost', untuk identitas pemilik
    image_url TEXT, -- Link gambar (Base64 string atau Cloudflare R2 link)
    status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'completed', 'archived'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: sessions (Untuk menjaga user tetap login)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexing untuk mempercepat pencarian (GG Optimization)
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
