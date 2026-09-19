# Blackwater Portable Blog CMS - Setup & Deployment Guide

A 100% self-hosted, portable, host-independent Blog CMS built with Node.js, direct MySQL driver (`mysql2`), and server-filesystem image storage (`/public/uploads/blogs/`).

---

## Local Development Setup

### 1. Requirements
* Node.js (v18 or higher)
* MySQL Server / MariaDB (via MySQL Community Server, XAMPP, Laragon, or Docker)

### 2. Database Initialization
1. Start your local MySQL server.
2. Open MySQL CLI or PhpMyAdmin and create a new database:
   ```sql
   CREATE DATABASE blackwater_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import `database/schema.sql` and `database/seed.sql`:
   ```bash
   mysql -u root -p blackwater_blog < database/schema.sql
   mysql -u root -p blackwater_blog < database/seed.sql
   ```
   *(Note: The server auto-executes `schema.sql` and `seed.sql` on startup if tables or admin user are missing)*

### 3. Environment Configuration
Create a `.env` file in the project root based on `.env.example`:
```env
PORT=3000
APP_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=blackwater_blog

JWT_SECRET=super_secret_jwt_key_2026
MAX_FILE_SIZE_MB=5
```

### 4. Running the Project
1. Install dependencies (if not already done):
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open your browser:
   * **Admin CMS Dashboard**: [http://localhost:3000/admin/login.html](http://localhost:3000/admin/login.html)
   * **Public Blog Listing**: [http://localhost:3000/blog](http://localhost:3000/blog)

### 5. First Login & Verification
* **Default Admin Credentials**:
  * **Email / Username**: `admin` or `admin@blackwater.com`
  * **Password**: `admin123`
* **Test Flow**:
  1. Log in to the CMS dashboard.
  2. Click **Create New Blog**.
  3. Enter a title, write content, select a category, and upload a featured image.
  4. Save as **Published**.
  5. Visit [http://localhost:3000/blog](http://localhost:3000/blog) to verify your article appears on the public website.

---

## Production Deployment Guide (Hostinger, Bluehost, GoDaddy, VPS)

Because this application uses standard Node.js and standard MySQL without cloud vendor locks (no Vercel Blob, Cloudinary, Prisma, Supabase, or Firebase), it can be deployed on any web host.

### Step 1: Create Production MySQL Database
1. Log into your hosting account (cPanel, Hostinger hPanel, or VPS CLI).
2. Go to **MySQL Databases** and create a new database (e.g. `u12345_blackwater`).
3. Create a database user and generate a secure password.
4. Assign all privileges (`ALL PRIVILEGES`) to the database user.
5. Open **phpMyAdmin** on your server and import `database/schema.sql` (and optionally `database/seed.sql`).

### Step 2: Upload Application Files
1. Zip the project folder (excluding `node_modules` and local `.env`).
2. Upload and extract files to your server directory (e.g. `/public_html` or `/home/user/apps/blackwater`).

### Step 3: Configure Permissions
1. Ensure the directory `public/uploads/blogs/` exists on the server.
2. Set directory permissions to **`755`** or **`775`** so Node.js can write uploaded images to disk.

### Step 4: Configure Production Environment (`.env`)
Create a `.env` file on your server with live credentials:
```env
PORT=3000
APP_URL=https://yourdomain.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=u12345_bloguser
DB_PASSWORD=YourSecureProductionPassword123!
DB_NAME=u12345_blackwater

JWT_SECRET=RandomLongProductionSecretKey2026!
MAX_FILE_SIZE_MB=5
```

### Step 5: Start Node.js Application
* **On cPanel / hPanel (Node.js App Selector)**:
  1. Select Node.js Version (v18 or higher).
  2. Set Application root: `/`
  3. Set Application URL: `yourdomain.com`
  4. Set Application startup file: `server.js`
  5. Click **Run npm install**, then **Start App**.
* **On VPS (using PM2)**:
  ```bash
  npm install
  npm install -g pm2
  pm2 start server.js --name "blackwater-blog"
  pm2 save
  ```

---

## Backup & Migration Strategy

### 1. Database Backup
Export the MySQL database as a `.sql` file:
```bash
mysqldump -u DB_USER -p DB_NAME > blog_database_backup.sql
```

### 2. Media / Uploads Backup
Compress the uploaded featured images:
```bash
tar -czvf blog_images_backup.tar.gz public/uploads/blogs/
```

### 3. Server Migration (e.g. Hostinger -> Bluehost or GoDaddy)
To move the entire website and Blog CMS to a new server:
1. Copy the project files to the new server.
2. Import `blog_database_backup.sql` into the new server's MySQL database.
3. Extract `blog_images_backup.tar.gz` into `public/uploads/blogs/`.
4. Update `.env` with the new server's database credentials.
5. Start Node.js (`npm start` or PM2).
