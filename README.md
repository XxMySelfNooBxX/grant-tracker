# 🛡️ Microgrant Tracking and Impact Evaluation Platform

## 1. Project Introduction
This platform revolutionizes microgrant management by enhancing backend security and automating fraud detection for student financial assistance. This phase focuses on creating a tamper-proof financial ledger and optimizing proof-of-usage verification using digital forensics.

## 2. Epics & Core Features
**Feature #1: Automated Forensic Scanning (EXIF)**
* Isolated microservice using the `exifr` library to extract metadata (creation date, location) from uploaded receipts to detect timeline fraud.
**Feature #2: Cryptographic Financial Ledger**
* Uses the Node.js `crypto` library to chain SHA-256 hashes for every approved grant, ensuring database records are append-only and immutable.
**Feature #3: Real-Time Fraud Alerts**
* Integration with a Discord webhook to instantly alert administrators when forensics anomalies (e.g., falsified timestamps) are detected.

## 3. Deployment Architecture
* **Frontend (React):** Deployed on Vercel
* **Backend (Node/Express API Gateway):** Deployed on Render
* **Database (MongoDB):** Cloud-hosted on MongoDB Atlas
* **Evidence Storage:** Amazon S3 (for receipts and FORENSIC artifacts)

## 4. Current File Structure
Based on the initial commit architecture:

```text
📂 grant-tracker
├── 📂 client          # React Frontend application
│   ├── 📂 src
│   │   ├── 📂 components  # Admin/Applicant Dashboards & Login UI
│   │   ├── App.js         # Core React routing
│   │   └── index.js       # React entry point
│   ├── package.json       # Frontend dependencies (jspdf, etc.)
│   └── README.md          # Client-specific notes
├── 📂 server          # Node.js/Express API Gateway
│   ├── index.js           # Core backend server logic
│   └── package.json       # Backend dependencies (crypto, multer)
└── .gitignore         # Critical security file (ignores node_modules)