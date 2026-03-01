# Clean Madurai 🌿
> **Smart Waste & Cleanliness Platform**

**Motto**: *"Make Madurai the cleanest city in India – every Madurai person contributes."*

Clean Madurai is a comprehensive, AI-powered platform designed to make Madurai the cleanest city in India. Built to be an inclusive, government-ready platform, it connects citizens, corporation officers, and volunteers through smart waste reporting, block adoption, and gamified community clean-up initiatives.

![Clean Madurai Coverage](https://via.placeholder.com/800x400?text=Clean+Madurai+Platform)

---

## 🚀 Key Features

*   **Role-Based Workflows**: Tailored dashboards for Citizens, Corporation Officers, Admins, Sanitation Workers, and business owners (Hotels, Shops, Markets).
*   **Live Interactive City Map**: Real-time visualization of waste reports, clean scores by street, hazard zones, and active civic drives across Madurai wards.
*   **Smart Waste Reporting**: Report waste seamlessly using:
    *   **Photos**: Upload photo and tag the location.
    *   **Voice (NLP)**: Tamil/English voice reports parsed into structured locations and categories.
    *   **AI Vision Scan**: Real-time camera evaluation to auto-classify garbage type.
*   **AI Before/After Verification**: Automated assessment comparing before-and-after photos of waste sites to verify clean-ups and automatically disburse reward points.
*   **"Adopt a Block"**: Step up as a block-owner for a 100-meter street segment. Prove cleanliness via weekly uploads to maintain a "green" status on the map.
*   **Waste Exchange Marketplace**: Connecting bulk generators (hotels, shops) with farmers, animal caretakers, and recyclers to divert organic and recyclable waste away from landfills.
*   **Emergency Glass SOS**: Dedicated hazard reporting queue ensuring immediate dispatch for dangerous waste (e.g., shattered glass).
*   **Gamification & Real Rewards**: Earn points for making reports and resolving issues. Reedem points for real-world rewards like shop discounts and fuel coupons.

---

## 🛠️ Tech Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **PWA** | Vite PWA Plugin, Workbox (Offline Caching) |
| **Authentication** | Firebase Auth (Email/Password, Phone OTP) |
| **Database** | Firebase Firestore (Real-time updates) |
| **Storage & Functions** | Firebase Storage, Firebase Cloud Functions |
| **Maps & Routing** | Leaflet.js, OpenStreetMap, Nominatim Geocoding |
| **AI Processing** | TensorFlow.js (Device level), Gemini API (Cloud) |
| **Analytics** | Firebase Analytics |

---

## 👥 Supported Roles & Personas

*   **Citizen**: Report waste, earn points, track reports, adopt blocks, participate in clean drives.
*   **Corporation Officer**: Monitor ward map, assign sanitation crews, handle SOS requests.
*   **Sanitation Worker**: Receive designated tasks, navigate to locations, mark jobs as resolved.
*   **Corporation Admin**: Oversee city-wide analytics, monitor performance, and manage staff/officers.
*   **Business Owners (Hotel / Shop / Market)**: List organic, packaging, or vegetable waste.
*   **Farmers & Recyclers**: Claim business listings for composting, animal feed, or recycling.
*   **Auto Driver**: "Top City Protectors" making one-tap reports on-the-go to earn fuel coupons.
*   **Volunteer / College Admin**: Form teams and participate in the "College Clean League".

---

## 📥 Getting Started

### Prerequisites
*   Node.js (v18+ recommended)
*   NPM / Yarn
*   A active Firebase Project with Auth, Firestore, Storage, and Functions enabled.

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/clean-madurai.git
    cd clean-madurai
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Copy the example `.env` file and populate it with your Firebase configuration and API keys.
    ```bash
    cp .env.example .env.local
    ```

4.  **Run Locally**
    Start the Vite development server:
    ```bash
    npm run dev
    ```

5.  **Build for Production**
    ```bash
    npm run build
    ```

---

## 🔥 Gamification Economy
The platform employs a robust point system:
*   Submit photo report: `+10 pts`
*   Submit AI/Voice report: `+10 to +12 pts`
*   Adopt block: `+50 pts`
*   Verified AI cleanup: `+20 pts` (to citizen & worker)

*Rankings and leaderboards reset weekly or monthly for maximum community engagement!*

---

## 🌐 Language & Accessibility
*   **Tamil First**: Fully supported Tamil interface and voice workflows out of the box.
*   **PWA Ready**: Operates like a native app. Works under slow connectivity and doesn't demand heavy App Store downloads.

---
*Built with ❤️ for a Greener Madurai.*
