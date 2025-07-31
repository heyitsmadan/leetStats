<div align="center">
  <img src="https://raw.githubusercontent.com/heyitsmadan/leetStats/main/public/assets/icons/icon128.png" alt="leetStats Logo" width="128" />
  <h1>leetStats</h1>
  <p>Advanced Analytics for Your LeetCode Journey</p>
  <p>
    <a href="https://github.com/heyitsmadan/leetStats/issues/new?assignees=&labels=bug&template=bug_report.md&title=">Report a Bug</a> ·
    <a href="https://github.com/heyitsmadan/leetStats/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=">Request a Feature</a>
  </p>
</div>

---

<div align="center">
  <img alt="leetStats Shareable Card" src="https://github.com/user-attachments/assets/31f687d1-7f4c-4dae-8cd1-ef98b5bf8557" />
</div>

<p align="center">
  <a href="https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-v1.0.0-blue?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/YOUR_ADDON_ID/">
    <img src="https://img.shields.io/badge/Firefox_Add--ons-v1.0.0-orange?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Firefox Add-ons">
  </a>
  <br />
  <img src="https://img.shields.io/github/license/heyitsmadan/leetStats?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/github/stars/heyitsmadan/leetStats?style=for-the-badge&logo=github" alt="Stars">
</p>

---

## 🚀 What is leetStats?

**leetStats** is a browser extension that adds a powerful "Stats" tab directly to your [LeetCode](https://leetcode.com/) profile. It transforms your public submission data into a beautiful, interactive dashboard with insightful analytics.

---

## 📚 Table of Contents

- [✨ Key Features](#-key-features)
- [📸 Screenshots](#-screenshots)
- [🚀 Installation](#-installation)
- [💡 How to Use](#-how-to-use)
- [🛠️ Built With](#-built-with)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## ✨ Key Features

| Feature                      | Description |
|------------------------------|-------------|
| 📊 **Interactive History**   | A dynamic, filterable, and zoomable chart of your entire submission history. |
| 🏆 **Milestones & Trophies** | A timeline of your key achievements and fun, relatable trophies for your coding journey. |
| 📈 **In-Depth Analytics**    | Visualize your growth, discover your most productive times, and analyze submission verdicts. |
| 🧠 **Skills Analysis**       | Granular topic-wise tracking of solved problems, average attempts, and more. |
| 🖼️ **Custom Share Card**     | Generate a beautiful, bento-style card showcasing your favorite stats. |
| 🔒 **Privacy-Focused**       | 100% local. No data ever leaves your browser. [Read Privacy Policy](#). |

---

## 📸 Screenshots

<details>
<summary><b>Click to view more screenshots</b></summary>
<br>

<p align="center"><b>Main Dashboard View</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/35c4c4f0-e200-4188-a0d2-dabf7495b88b" width="700" />
</p>

<p align="center"><b>Skills Analysis</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b14b23c1-0120-4b7d-8e94-c8dbd337be45" width="700" />
</p>

<p align="center"><b>Trophies & Records</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/1cb66d1c-a3c3-4d49-9724-c2fcf36d7ed9" width="700" />
</p>

<p align="center"><b>Milestones Timeline</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/0d428c08-e29c-4036-a840-83a2809ebc49" width="700" />
</p>

<p align="center"><b>Shareable Card Customizer</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/c845206b-47ff-4590-9e48-ad5495cf62cb" width="700" />
</p>

</details>

---

## 🚀 Installation

### ✅ From Official Stores (Recommended)

Install the latest stable version:

- [Chrome Web Store](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/YOUR_ADDON_ID/)
- Also works on Edge, Brave, Opera

### 🧑‍💻 From Source (Developers)

```bash
git clone https://github.com/heyitsmadan/leetStats.git
cd leetStats
npm install
npm run build
```

Then load the extension manually:

- **Chrome/Edge**: Go to `chrome://extensions`, enable "Developer mode", and click **Load unpacked** → select the `dist/` folder.
- **Firefox**: Go to `about:debugging`, click **This Firefox**, then **Load Temporary Add-on** → select `dist/manifest.json`.

---

## 💡 How to Use

1. Install the extension.
2. Log into your LeetCode account.
3. Go to your profile page.
4. Click the new **"Stats"** tab next to "Discuss".
5. On the first visit, data is fetched and cached locally for faster subsequent loads.

---

## 🛠️ Built With

- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Chart.js](https://www.chartjs.org/)
- [D3.js](https://d3js.org/)
- [CRXJS Vite Plugin](https://crxjs.dev/)

---

## 🤝 Contributing

Contributions are welcome! Whether it's a bug report, feature suggestion, or pull request — your input is valuable. Feel free to [open an issue](https://github.com/heyitsmadan/leetStats/issues) to get started.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.