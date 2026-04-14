# DentalCare - Modern Clinic Management System

DentalCare is a robust, cross-platform desktop application built with Tauri, React, and Rust. It is designed to manage dental clinics with a focus on real-time synchronization, role-based access control, and offline reliability.

## 🚀 Features

- **Hub-and-Spoke Architecture:** Centralized data storage with local caching for seamless operation even during network outages.
- **Real-time Synchronization:** WebSocket-based updates keep all connected devices in sync instantly.
- **Role-Based Access Control (RBAC):**
  - **ADMIN:** Full system access, user management, and global settings.
  - **RECEPTION:** Patient registration, appointment scheduling, and payment processing.
  - **DOCTOR:** Clinical records, treatments, prescriptions, and waiver authorization.
- **Waiting Room Management:** Track patient flow from admission to consultation.
- **Waiver System:** Real-time authorization requests for fee discounts.
- **Data Management:** Built-in backup and restore functionality.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Shadcn UI.
- **Backend:** Rust, Tauri v2, Axum (Hub server).
- **Database:** SQLite (SQLx).
- **Real-time:** WebSockets.
- **Discovery:** mDNS for automatic Hub discovery.

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) (stable)
- **Linux dependencies:**
  ```bash
  sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libglib2.0-dev
  ```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

### Development

Run the application in development mode:
```bash
pnpm tauri dev
```

### Building

Build the production version:
```bash
pnpm tauri build
```

## 🏗 Architecture

DentalCare uses a **Hub-and-Spoke** model:
- **Hub:** Acts as the central server. It hosts the master database and manages WebSocket connections.
- **Spoke:** Connects to a Hub. It maintains a local SQLite database for offline capability and syncs changes when connected.

## 🧪 Testing

- **Frontend:** `pnpm lint`
- **Backend:** `cd src-tauri && cargo test`

## 📄 License

This project is licensed under the MIT License.
