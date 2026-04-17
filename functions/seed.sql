
-- Spetech Lost and Found - Initial Seed Data

-- 1. Masukkan Lokasi Resmi sesuai ketentuan Blueprint
INSERT INTO locations (name, description, qr_code_payload) VALUES 
('Gedung A', 'Area kelas dan kantor guru gedung A', 'lokasi=Gedung+A'),
('Gedung B', 'Area kelas dan lapangan gedung B', 'lokasi=Gedung+B'),
('Gedung C', 'Area gedung C dan ruang lainnya', 'lokasi=Gedung+C'),
('Lapangan Upacara', 'Area tengah lapangan upacara', 'lokasi=Lapangan+Upacara'),
('Lapangan Basket', 'Area olahraga basket', 'lokasi=Lapangan+Basket'),
('Lapangan Tenis', 'Area olahraga tenis', 'lokasi=Lapangan+Tenis'),
('Koperasi', 'Koperasi siswa SMP Techno', 'lokasi=Koperasi'),
('Kantin', 'Area kantin makan', 'lokasi=Kantin');

-- 2. Masukkan Akun Admin Default (Username: admin, Pass: admin123)
-- Catatan: Nanti di backend kita bisa buat pendaftaran yang lebih aman
INSERT INTO users (username, password, role) VALUES 
('admin', 'admin123', 'admin'),
('siswa', 'siswa123', 'user');

-- 3. Contoh Data Barang untuk Demo KTI (Initial Items)
INSERT INTO items (type, item_name, description, location_name, reporter_name, status) VALUES 
('found', 'Aphone', 'Ditemukan di dekat parkiran', 'Gedung A', 'Budi', 'verified'),
('lost', 'Iphone', 'Isi kartu pelajar atas nama Andi', 'Kantin', 'Andi', 'pending');
