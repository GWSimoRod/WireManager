# WireManager

WireManager is a modern, lightweight web application for managing, configuring, and monitoring **WireGuard** servers and peers. It simplifies VPN deployment, client access management, usage statistics, and dynamic firewall automation through an intuitive web interface.

## Quick Start

### Prerequisites
- [.NET 8/9 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (v18+)
- MySQL Database
- Linux host with WireGuard installed

### 1. Run the Backend API
```bash
cd WireManager.API
dotnet run
```
*Database migrations are applied automatically at startup.*

### 2. Run the Frontend
```bash
cd WireManager.Frontend
npm install
npm run dev
```
Once running, open `http://localhost:3000` in your browser.

---

## Documentation

For full installation guides, production deployment, configuration reference, and architecture details, please refer to the official documentation:

📖 **[https://docs.netrod.xyz](https://docs.netrod.xyz)**

---

## License

WireManager is source-available under the
[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).

Personal, hobby, educational, research and other permitted
noncommercial use is free.

Commercial use requires a separate commercial license from the
copyright holder.

See the [LICENSE](LICENSE) file for the complete license terms.
