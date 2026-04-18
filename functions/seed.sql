
-- Spetech Lost and Found - Initial Seed Data

-- 1. Masukkan Lokasi Resmi sesuai ketentuan Blueprint
INSERT INTO locations (name, description, qr_code_payload) VALUES 
('Gedung A', 'Area gedung A, termasuk TU, ruang guru, labkom, kelas.', '?lokasi=1'),
('Gedung B', 'Area gedung B lantai 1 dan 2, termasuk kelas dan halaman depan.', '?lokasi=2'),
('Gedung C', 'Area gedung C lantai 1 dan 2, termasuk kelas dan halaman depan.', '?lokasi=3'),
('Lapangan Upacara', 'Area sekitar lapangan upacara.', '?lokasi=4'),
('Lapangan Basket', 'Area sekitar lapangan basket.', '?lokasi=5'),
('Lapangan Tenis', 'Area sekitar lapangan di depan labkom.', '?lokasi=6'),
('Koperasi', 'Sekitar koperasi spetech.', '?lokasi=7'),
('Kantin', 'Sekitar ruang makan samping tenis, termasuk lantai 1 dan 2.', '?lokasi=8');

-- 2. Masukkan Akun Admin Default (Username: admin, Pass: admin123)
-- Catatan: Nanti di backend kita bisa buat pendaftaran yang lebih aman
INSERT INTO users (username, password, role) VALUES 
('admin', 'admin123', 'admin'),
('siswa', 'siswa123', 'user');

-- 3. Contoh Data Barang untuk Demo KTI (Initial Items)
INSERT INTO items (type, item_name, description, location_name, reporter_name, status) VALUES 
('found', 'Aphone', 'Ditemukan di dekat parkiran', 'Gedung A', 'Budi', 'verified'),
('lost', 'Iphone', 'Isi kartu pelajar atas nama Andi', 'Kantin', 'Andi', 'pending');
