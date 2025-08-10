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
  <img alt="leetStats Shareable Card" src="https://github.com/user-attachments/assets/b6653ab7-1cd3-4691-a39b-5a33a8b26b4e" />
</div>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/leetstats/caipeabgogcpmihgldebnaalinnaaeda">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-v1.0.0-blue?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/leetstats/">
    <img src="https://img.shields.io/badge/Firefox_Add--ons-v1.0.0-orange?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Firefox Add-ons">
  </a>
  <a href="https://microsoftedge.microsoft.com/addons/detail/leetstats/fcnelmphghognkimkhpannacikgnieaa">
    <img src="https://img.shields.io/badge/Edge_Add--ons-v1.0.0-blue?style=for-the-badge&logo=microsoft-edge&logoColor=white" alt="Edge Add-ons">
  </a>
  <a href="https://chromewebstore.google.com/detail/leetstats/caipeabgogcpmihgldebnaalinnaaeda">
    <img src="https://img.shields.io/badge/Available_for_Brave-v1.0.0-orange?style=for-the-badge&logo=brave&logoColor=white" alt="Available for Brave">
  </a>
  <br />
  <img src="https://img.shields.io/github/license/heyitsmadan/leetStats?style=for-the-badge" alt="License">
</p>

---

## 🚀 What is leetStats?

**leetStats** is a browser extension that adds a powerful "Stats" tab directly to your [LeetCode](https://leetcode.com/) profile. It transforms your submission data into a beautiful, interactive dashboard with insightful analytics.

---

## 📚 Table of Contents

- ✨ [Key Features](#-key-features)
- 📸 [Screenshots](#-screenshots)
- 🚀 [Installation](#-installation)
- 💡 [How to Use](#-how-to-use)
- 🛠️ [Built With](#-built-with)
- 🤝 [Contributing](#-contributing)
- 📜 [License](#-license)

---

## ✨ Key Features

| Feature                      | Description |
|------------------------------|-------------|
| 📊 **Interactive History**   | A dynamic, filterable, and zoomable chart of your entire submission history. |
| 🏆 **Milestones & Trophies** | A timeline of your key achievements and fun, relatable trophies for your coding journey. |
| 📈 **In-Depth Analytics**    | Visualize your growth, discover your most productive times, and analyze submission verdicts. |
| 🧠 **Skills Analysis**       | Granular topic-wise tracking of solved problems, average attempts, and more. |
| 🖼️ **Custom Shareable Card** | Generate a beautiful, bento-style card showcasing your favorite stats. |
| 🔒 **Privacy-Focused**       | 100% local. No data ever leaves your browser. <a href="https://heyitsmadan.github.io/leetStats/privacy.html" target="_blank" rel="noopener noreferrer">Read Privacy Policy</a>. |

---

## 📸 Screenshots

<details>
<summary><b>Click to view more screenshots</b></summary>
<br>

<p align="center"><b>History Chart</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/35c4c4f0-e200-4188-a0d2-dabf7495b88b" width="700" />
</p>

<p align="center"><b>Activity Charts</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b14b23c1-0120-4b7d-8e94-c8dbd337be45" width="700" />
</p>

<p align="center"><b>Milestones & Trophies</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/1cb66d1c-a3c3-4d49-9724-c2fcf36d7ed9" width="700" />
</p>

<p align="center"><b>Milestones & Records</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/0d428c08-e29c-4036-a840-83a2809ebc49" width="700" />
</p>

<p align="center"><b>Skills</b></p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/c845206b-47ff-4590-9e48-ad5495cf62cb" width="700" />
</p>

</details>

---

## 🚀 Installation

### ✅ From Official Stores (Recommended)

Install the latest stable version:

- [Chrome Web Store](https://chromewebstore.google.com/detail/leetstats/caipeabgogcpmihgldebnaalinnaaeda)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/leetstats/)
- [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/leetstats/fcnelmphghognkimkhpannacikgnieaa)
- [Brave Web Store](https://chromewebstore.google.com/detail/leetstats/caipeabgogcpmihgldebnaalinnaaeda)

### 🧑‍💻 From Source (Developers)

```bash
git clone https://github.com/heyitsmadan/leetStats.git
cd leetStats
npm install
npm run build
```

Then load the extension manually:

- **Chrome / Brave**: Go to `chrome://extensions`, enable "Developer mode", and click **Load unpacked** → select the `dist/` folder.
- **Edge**: Go to `edge://extensions`, enable "Developer mode", and click **Load unpacked** → select the `dist/` folder.
- **Firefox**: Go to `about:debugging`, click **This Firefox**, then **Load Temporary Add-on** → select `dist/manifest.json`.

---

## 💡 How to Use

1. Install the extension from your preferred store or from source.
2. Log into your LeetCode account.
3. Navigate to your profile page.
4. The extension will automatically fetch and locally cache your submission history.
5. Click the new **"Stats"** tab next to **"Discuss"** to explore your insights.

---

## 🛠️ Built With

- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Chart.js](https://www.chartjs.org/)
- [D3.js](https://d3js.org/)

---

## 🤝 Contributing

Contributions are welcome! Whether it's a bug report, feature suggestion, or pull request — your input is valuable. Feel free to [open an issue](https://github.com/heyitsmadan/leetStats/issues) to get started.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
