# Inspire for Change

This is a local-first application designed for guest registration at the "Inspire for Change" events. It stores data locally in a JSON-based database for simplicity and offline use while providing a full authentication and administration workflow.

## Running the Application Locally

1. Install the dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:8080`.

## Connecting to Multiple Devices on the Same Network

If you want to use the application across multiple devices (like tablets, phones, or other laptops) connected to the **same Wi-Fi network**, follow these steps:

1. Stop your current `npm run dev` process.
2. Start the development server exposing your local IP address:
   ```bash
   npm run dev -- --host
   ```
   *Alternatively, you can run `npx vite dev --host`.*

3. Look at your terminal output. You should see a line similar to:
   ```
   ➜  Network:  http://192.168.1.50:8080/
   ```

4. On any other device connected to the same Wi-Fi network, open a web browser and type in that exact Network URL (e.g., `http://192.168.1.50:8080/`).

> **Note**: Both devices must be on the same network (e.g., connected to the same router or mobile hotspot) for this to work.
