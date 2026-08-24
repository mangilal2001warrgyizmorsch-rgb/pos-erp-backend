# POS ERP Backend Server

A robust, realtime Express.js backend for the POS ERP system. It handles inventory management, sales, customer data, and provides real-time updates via WebSockets.

## 🚀 Technologies & Libraries Used

- **Node.js & Express.js** - Core server framework (`express`)
- **MongoDB & Mongoose** - Database and ODM (`mongoose`)
- **Socket.IO** - Realtime bi-directional communication (`socket.io`)
- **Authentication & Security:**
  - `jsonwebtoken` - JWT-based authentication
  - `bcryptjs` - Password hashing
  - `cors` - Cross-Origin Resource Sharing
  - `express-rate-limit` - API rate limiting for security
- **Validation** - `express-validator` for API payload validation
- **Integrations:**
  - `@kapso/whatsapp-cloud-api` - WhatsApp messaging integration
  - `twilio` - SMS integration
- **File Handling & PDF Generation:**
  - `multer` - File uploads
  - `pdfkit` - Dynamic PDF generation for invoices
  - `roboto-font` - Font support for PDF generation (including Rupee symbol ₹)
- **Utilities:**
  - `dotenv` - Environment variable management
  - `morgan` - HTTP request logger

## ⚙️ Step-by-Step Setup Guide

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)

### 2. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your configurations:
```env
PORT=5500
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
# Add your Twilio or Kapso keys here if needed
```

### 4. Running the Server

**Development Mode:**
```bash
npm run dev
```
*Runs with nodemon for automatic restarts on file changes.*

**Production Mode:**
```bash
npm start
```

### 5. Seeding the Database (Optional)
To populate the database with dummy data for testing:
```bash
npm run seed
```
