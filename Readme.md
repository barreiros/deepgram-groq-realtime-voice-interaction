# 🤖 Multimodal AI + Three.js: Voice-Controlled Interaction

This project demonstrates how to interact with **Three.js environments** using **multimodal AI systems** and **voice commands**, powered by the **Gemini Live API**. Users can control and manipulate 3D scenes through spoken instructions, enabling seamless interaction between AI-driven interfaces and real-time 3D rendering.

## 🚀 Features

- **Improved Audio Playback** – Enhanced front-end audio handling to avoid undesirable clipping.
- **Voice Commands** – Move, scale, and manipulate 3D objects using intuitive speech inputs.
- **Gemini Live API Integration** – Real-time voice processing and AI-driven interaction.
- **Three.js Scene Control** – Dynamic scene updates and animations based on AI-generated instructions.
- **WebSockets / API Calls** – Enables smooth real-time communication with AI models.

## 🛠️ Technologies Used

- **Three.js** – Web-based 3D rendering.
- **Gemini Live API** – Multimodal AI interaction (voice only).
- **Custom Audio Modules** – Developed based on the audio components from the official [Gemini Cookbook repository](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_LiveAPI.py), with enhancements to improve audio recording and playback functionalities.

## 📌 Use Cases

- **Voice-controlled 3D environments.**
- **AI-assisted 3D modeling.**
- **Educational & interactive simulations.**

## 🛠️ Installation & Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** (latest LTS version recommended)
- **npm** (Node package manager)

### Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the application:**
   ```bash
   npm run dev
   ```

## 🏗️ Technological Stack

### Frontend

- **React** – JavaScript library for building user interfaces.
- **Tailwind CSS** – Utility-first CSS framework.
- **ViteJS** – Fast, modern frontend build tool.
- **Three.js** – JavaScript 3D library for creating and displaying animated 3D computer graphics.
- **WebSocket Client** – Native WebSocket API for real-time communication.
- **Web Audio API** – For audio recording and playback.
- **Audio Worklets** – For real-time audio processing.

### Backend

- **Node.js** – JavaScript runtime for server-side code.
- **Express.js** – Web application framework for Node.js.
- **WebSocket Server** – Using the 'ws' library for WebSocket functionality.
- **Gemini API** – Google's multimodal AI service for audio processing.
- **AI Service Abstraction** – Architecture supporting multiple AI providers.
