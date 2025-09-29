# 🎓 E-Learning Platform - Sistem Pembelajaran Online Terpadu

Sebuah platform pembelajaran online yang dirancang khusus untuk memfasilitasi pendidikan digital yang interaktif dan efisien. Platform ini menghubungkan kepala sekolah, guru, dan siswa dalam ekosistem pembelajaran yang terintegrasi.

## 🌟 Visi & Misi

**Visi:** Menciptakan ekosistem pembelajaran digital yang mudah diakses, interaktif, dan mendukung kemajuan pendidikan di era modern.

**Misi:**
- Memfasilitasi pembelajaran jarak jauh yang efektif
- Menyediakan tools manajemen pendidikan yang komprehensif
- Meningkatkan keterlibatan siswa dalam proses pembelajaran
- Memberikan insight yang mendalam tentang progress akademik

## 🚀 Fitur-Fitur Unggulan

### 👑 Dashboard Kepala Sekolah
- **Manajemen Pengguna Terpusat**: Kelola guru dan siswa dengan sistem role-based access
- **Analitik Sekolah Real-time**: Monitoring aktivitas pembelajaran, statistik pengguna, dan performance metrics
- **Manajemen Kelas**: Buat, edit, dan kelola kelas dengan assignment guru dan siswa
- **Laporan Komprehensif**: Dashboard dengan visualisasi data pembelajaran dan progress tracking
- **Diskusi Kelas**: Moderasi dan monitoring aktivitas diskusi pembelajaran
- **Manajemen Materi**: Oversight terhadap semua materi pembelajaran yang dibuat guru

### 👨‍🏫 Dashboard Guru
- **Manajemen Materi**: Buat, edit, dan distribusikan materi pembelajaran dengan rich text content
- **Sistem Penilaian Terintegrasi**: Buat tugas, kelola submission, dan berikan feedback komprehensif
- **Monitoring Progress Siswa**: Track individual dan class progress dengan detailed analytics
- **Diskusi & Komunikasi**: Moderasi forum diskusi dan berikan feedback langsung
- **Wali Kelas Dashboard**: Fitur khusus untuk wali kelas dengan statistik kelas yang mendalam
- **Deadline Management**: Sistem reminder dan tracking untuk tugas-tugas yang akan datang

### 👨‍🎓 Dashboard Siswa
- **Learning Hub Interaktif**: Akses materi pembelajaran dengan progress tracking otomatis
- **Tugas & Assignment**: Submit tugas, lihat feedback, dan track nilai secara real-time
- **Progress Monitoring**: Visualisasi progress pembelajaran personal dengan statistik detail
- **Forum Diskusi**: Berpartisipasi dalam diskusi kelas dan diskusi per-materi
- **Grade Center**: Pusat nilai dengan breakdown per mata pelajaran dan feedback guru

### 🔧 Fitur Teknis Lanjutan
- **Multi-role Authentication**: JWT-based session management dengan role-based permissions
- **Responsive Design**: UI yang adaptive untuk desktop dan mobile
- **Data Security**: Implementasi security headers dan input validation
- **Rate Limiting**: Perlindungan dari spam dan abuse
- **Thread-based Discussion**: Sistem diskusi berbasis forum dengan reply functionality

## 🛠 Teknologi Stack

### Backend
- **Runtime**: Bun.js - TypeScript runtime yang cepat dan modern
- **Framework**: Elysia.js - Type-safe web framework dengan performance tinggi
- **Database**: MySQL dengan connection pooling untuk performa optimal
- **Authentication**: Custom JWT-based session management
- **Session Management**: Cookie-based session dengan secure configuration

### Frontend
- **Templating**: EJS (Embedded JavaScript) untuk server-side rendering
- **Styling**: Vanilla CSS dengan modern design principles
- **JavaScript**: ES6+ dengan async/await patterns
- **UI/UX**: Responsive design dengan mobile-first approach

### Security & Performance
- **Security Headers**: Comprehensive security headers implementation
- **Input Validation**: Zod schema validation untuk data integrity
- **Rate Limiting**: Request throttling untuk mencegah abuse
- **Password Security**: Bcrypt hashing dengan salt
- **CORS**: Cross-Origin Resource Sharing configuration

## 📊 Arsitektur Sistem

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Elysia Server  │    │   MySQL DB      │
│                 │◄──►│                  │◄──►│                 │
│ - Dashboard UI  │    │ - API Routes     │    │ - User Data     │
│ - Forum         │    │ - Auth System    │    │ - Learning Data │
│   Discussion    │    │ - Middleware     │    │ - Progress      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🎯 Tujuan Aplikasi

### Untuk Institusi Pendidikan
- **Digitalisasi Pembelajaran**: Transformasi dari metode konvensional ke digital
- **Efisiensi Administrasi**: Otomatisasi tugas administratif dan reporting
- **Peningkatan Engagement**: Tools interaktif untuk meningkatkan partisipasi siswa
- **Data-Driven Decisions**: Analytics untuk pengambilan keputusan berbasis data

### Untuk Pendidik
- **Streamlined Teaching**: Tools yang memudahkan proses mengajar dan evaluasi
- **Better Student Insights**: Understanding mendalam tentang progress dan kebutuhan siswa
- **Collaborative Environment**: Platform untuk komunikasi dan kolaborasi yang efektif
- **Time Efficiency**: Otomatisasi tugas repetitif seperti grading dan progress tracking

### Untuk Siswa
- **Flexible Learning**: Akses pembelajaran kapan saja dan di mana saja
- **Self-Paced Progress**: Pembelajaran sesuai dengan kecepatan individual
- **Instant Feedback**: Feedback langsung untuk improvement yang cepat
- **Engaging Experience**: UI/UX yang menarik dan interaktif

## 🚧 Tantangan & Solusi

### 1. **Multi-role Access Control**
**Tantangan**: Sistem permission yang fleksibel namun secure untuk tiga role berbeda
**Solusi**: Role-based middleware dengan granular permission checking dan session validation

### 2. **Data Consistency**
**Tantangan**: Menjaga konsistensi data antar multiple concurrent users
**Solusi**: Database transactions dan proper error handling dengan connection pooling

### 3. **Performance Optimization**
**Tantangan**: Loading time dan responsiveness dengan data yang besar
**Solusi**: Efficient database queries, lazy loading, dan optimized API endpoints

### 4. **User Experience**
**Tantangan**: Interface yang intuitive untuk user dengan technical literacy yang berbeda
**Solusi**: Progressive enhancement dan consistent design patterns across all dashboards

### 5. **Discussion Management**
**Tantangan**: Organizing threaded discussions yang mudah diikuti
**Solusi**: Hierarchical comment system dengan parent-child relationship

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+ atau Bun runtime
- MySQL 8.0+
- Git

### Installation Steps

```bash
# Clone repository
git clone [repository-url]
cd e-learning-platform

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env
# Edit .env dengan konfigurasi database dan secrets

# Initialize database
bun run db:init

# Start development server
bun run dev
```

### Environment Configuration

```env
# Database
HOST=localhost
DATABASE_USER=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=elearning_db

# Security
SESSION_SECRET=your-super-secret-key-change-this

# Server
PORT=3000
```

## 📱 Penggunaan

### Akses Default
- **URL**: http://localhost:3000
- **Kepsek**: kepsek@example.com / 123456
- **Guru**: guru@example.com / 123456  
- **Siswa**: siswa1@example.com / 123456

### Flow Pembelajaran
1. **Kepsek** membuat kelas dan menugaskan guru
2. **Guru** membuat materi dan tugas untuk kelas mereka
3. **Siswa** mengakses materi, mengerjakan tugas, dan berpartisipasi dalam diskusi
4. **Guru** menilai tugas dan memberikan feedback
5. **Semua stakeholder** dapat memonitor progress melalui dashboard masing-masing

## 🔌 API Documentation

### Authentication

Semua API endpoint (kecuali auth) memerlukan session cookie yang valid. Session dikelola menggunakan JWT token dalam HTTP-only cookie.

#### Login
```http
POST /login
Content-Type: application/x-www-form-urlencoded

email=user@example.com&password=123456
```

**Response:**
- Success: Redirect ke `/dashboard`
- Error: 401 dengan pesan error

#### Logout
```http
POST /logout
```

### Kepala Sekolah API

Base URL: `/kepsek/*`

#### Dashboard & Statistics
```http
GET /kepsek/info-dasar
```
**Response:**
```json
{
  "success": true,
  "data": {
    "jumlah_guru": 5,
    "jumlah_siswa": 15,
    "jumlah_kelas": 3,
    "jumlah_materi": 9
  }
}
```

#### Guru Management
```http
GET /kepsek/guru/daftar
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "nama": "Jokowi, S.Pd",
      "email": "guru@example.com",
      "bidang": "Matematika",
      "kelas": "Kelas 1A, Kelas 2B",
      "status": "active",
      "last_login": "2024-01-15T10:30:00Z"
    }
  ]
}
```

```http
POST /kepsek/guru/tambah
Content-Type: application/json

{
  "nama": "Guru Baru",
  "email": "gurubaru@example.com",
  "password": "password123",
  "bidang": "Fisika"
}
```

```http
PATCH /kepsek/guru/status/{id}
Content-Type: application/json

{
  "status": "inactive"
}
```

#### Kelas Management
```http
GET /kepsek/kelas/daftar
```

```http
POST /kepsek/kelas/tambah
Content-Type: application/json

{
  "nama": "Kelas 4D",
  "tingkat": "4",
  "wali_kelas_id": 2
}
```

```http
PUT /kepsek/kelas/{id}
Content-Type: application/json

{
  "nama": "Kelas 4D Updated",
  "tingkat": "4"
}
```

### Guru API

Base URL: `/guru/*`

#### Dashboard
```http
GET /guru/dashboard/stats
```
**Response:**
```json
{
  "success": true,
  "data": {
    "total_materi": 3,
    "total_tugas": 5,
    "tugas_pending": 2,
    "rata_nilai": 85,
    "total_siswa": 25,
    "guru_info": {
      "nama": "Jokowi, S.Pd",
      "bidang": "Matematika",
      "kelas_mengajar": "Kelas 1A (Matematika), Kelas 2B (Matematika)",
      "is_wali_kelas": true
    }
  }
}
```

#### Materi Management
```http
GET /guru/materi
```

```http
POST /guru/materi
Content-Type: application/json

{
  "judul": "Trigonometri Dasar",
  "deskripsi": "Pembelajaran trigonometri untuk pemula",
  "konten": "Isi materi trigonometri...",
  "kelas_ids": [1, 2]
}
```

```http
PUT /guru/materi/{id}
Content-Type: application/json

{
  "judul": "Trigonometri Updated",
  "deskripsi": "Deskripsi updated",
  "konten": "Konten updated"
}
```

#### Tugas Management
```http
GET /guru/tugas
```

```http
POST /guru/tugas
Content-Type: application/json

{
  "judul": "Latihan Trigonometri",
  "deskripsi": "Kerjakan soal 1-10",
  "materi_id": 1,
  "deadline": "2024-02-01T23:59:59Z"
}
```

#### Penilaian
```http
GET /guru/submissions/pending
```

```http
POST /guru/submissions/{id}/grade
Content-Type: application/json

{
  "nilai": 85,
  "feedback": "Kerja yang baik, tingkatkan lagi"
}
```

#### Progress Siswa
```http
GET /guru/siswa/progress
```

```http
GET /guru/siswa/{id}/progress
```

### Siswa API

Base URL: `/siswa/*`

#### Dashboard
```http
GET /siswa/dashboard-stats
```
**Response:**
```json
{
  "success": true,
  "data": {
    "total_materi": 5,
    "materi_dipelajari": 3,
    "total_tugas": 8,
    "tugas_selesai": 5,
    "tugas_pending": 2,
    "rata_nilai": 87,
    "overall_progress": 65,
    "kelas": ["Kelas 1A (Tingkat 1)"]
  }
}
```

#### Materi
```http
GET /siswa/materi
```

```http
GET /siswa/materi/{id}
```

```http
POST /siswa/materi/{id}/complete
```

#### Tugas
```http
GET /siswa/tugas
```

```http
POST /siswa/tugas/{id}/submit
Content-Type: application/json

{
  "jawaban": "Jawaban lengkap untuk tugas ini..."
}
```

#### Nilai
```http
GET /siswa/nilai
```

#### Diskusi
```http
GET /siswa/diskusi-kelas
```

```http
GET /siswa/diskusi-materi
```

```http
POST /siswa/diskusi-materi
Content-Type: application/json

{
  "materi_id": 1,
  "isi": "Pertanyaan atau komentar tentang materi"
}
```

### Common Response Format

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional detailed error info"
}
```

### HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (not logged in)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

### Rate Limiting

API dibatasi 60 requests per menit per IP address untuk mencegah abuse.

### Authentication & Authorization

- Session-based authentication menggunakan HTTP-only cookies
- Role-based access control (RBAC) dengan 3 role: `kepsek`, `guru`, `siswa`
- Middleware otomatis memverifikasi role untuk setiap endpoint

### Error Handling

Semua endpoint mengembalikan struktur error yang konsisten dengan informasi yang memadai untuk debugging.

## 🔮 Future Roadmap

### Phase 1 (Current - Completed)
- ✅ Multi-role authentication system
- ✅ CRUD operations untuk materi dan tugas
- ✅ Progress tracking dan analytics
- ✅ Forum diskusi berbasis thread
- ✅ Dashboard analytics untuk semua role
- ✅ Sistem penilaian terintegrasi

### Phase 2 (Next Development)
- 🚧 Real-time chat system dengan WebSocket
- 📁 File upload untuk materi dan tugas (PDF, images, documents)
- 📧 Email notifications untuk tugas dan pengumuman
- 🔔 Push notifications system
- 📊 Advanced analytics dan detailed reporting

### Phase 3 (Future Enhancement)
- 📱 Mobile responsive improvements
- 🤖 AI-powered learning recommendations
- 🌐 Multi-tenant architecture untuk multiple schools
- 📈 Advanced learning analytics dengan machine learning
- 🎥 Video conferencing integration
- 📅 Calendar integration untuk scheduling

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:
1. Fork repository
2. Buat feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buat Pull Request

### Development Guidelines
- Follow existing code structure dan patterns
- Write clear commit messages
- Test thoroughly sebelum submit PR
- Update documentation jika diperlukan

## 📄 Lisensi

Project ini menggunakan MIT License. Lihat file `LICENSE` untuk detail lengkap.

## 📞 Support & Contact

Untuk pertanyaan, bug reports, atau feature requests:
- 📧 Email: [your-email]
- 🐛 Issues: [GitHub Issues]
- 💬 Discussions: [GitHub Discussions]

---

**Dikembangkan dengan ❤️ untuk kemajuan pendidikan digital Indonesia**