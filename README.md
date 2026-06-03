<div align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NextJS-Dark.svg" width="60" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" width="60" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" width="60" />
  
  <br/><br/>
  
  <h1>🤖 Nexus AI Interview Coach</h1>
  <p><b>An Enterprise-Grade, Autonomous AI Technical Interview Simulator with Strict Anti-Cheat Proctoring.</b></p>
</div>

<br/>

## 🌟 Overview
The **Nexus AI Interview Coach** is not just a chatbot. It is a fully autonomous, hybrid application that combines **Cloud-Based Large Language Models (LLMs)** with **Edge-Computed Computer Vision** to simulate a high-stress, deeply technical interview environment. 

By analyzing your uploaded Resume/CV against a target Job Description, the AI dynamically generates technical questions, listens to your spoken answers, watches your facial movements to ensure you aren't cheating, and grades you purely on semantic technical accuracy.

---

## 🏗️ The Hybrid Architecture
We intentionally split the computational workload to optimize speed and cost while preventing LLM hallucination.

### 1. The Brain: Cloud NLP (Groq + Llama 3.3 70B)
Instead of relying on a slow, generic LLM, we utilized **Groq's hyper-fast LPU inference engine** running the flagship `llama-3.3-70b-versatile` model. 
* **RAG Pipeline:** The AI extracts your resume text and contextualizes it against the Job Description to generate hyper-personalized questions.
* **Semantic Grading:** When you speak, your voice is transcribed and sent to the LLM. The AI evaluates the *semantics* and logic of your answer (ignoring "ums" and "ahs") and returns a strict 0-100 JSON score.

### 2. The Eyes: Edge Computer Vision (MediaPipe)
We completely bypassed relying on LLMs for behavioral tracking. Instead, we run a deep-learning **468-point Facial Mesh model** locally in your browser using WebGL/WASM.
* **Proctoring:** It mathematically tracks your head movements in real-time at 30fps without sending any video data to a server.

---

## 🚀 Core Features

### 🛡️ Enterprise 3-Strike Anti-Cheat System
* **Tab-Switching Detection:** The moment you click away from the browser, a massive red warning flashes, and your confidence score drops to zero.
* **3-Strike Missing Face System:** If you leave the camera frame for more than 2 seconds, a strike is logged. At 3 strikes, the interview is instantly terminated, and you are flagged with a "PROCTORING VIOLATION" on your final report.
* **Lip-Sync Detection:** The engine actively calculates the pixel distance between your upper lip (Landmark 13) and lower lip (Landmark 14). If the system detects active audio, but your lips are perfectly closed, it docks your confidence score as a baseline defense against deepfakes or fake voice-overs!

### 📄 Strict Resume Validation (Anti-Hallucination)
Users cannot upload a restaurant menu or a legal document to trick the system. The backend extracts the first 2,000 characters of the PDF and pipes it through a strict JSON-mode LLM classifier. If it lacks work experience or education sections, the upload is instantly rejected with the AI's exact reasoning.

### 📊 Comprehensive Radar Analytics
Your final dashboard doesn't just give you a single grade. It breaks your performance down into a Radar Chart spanning **Technical Depth**, **Problem Solving**, **Communication**, and **Eye Contact**. (And yes, if you completely bomb the technical portion or skip all questions, a hard override zeroes out your entire chart so you can't pass on confidence alone!).

---

## 🧗‍♂️ The Journey: Successes & Failures

Building this system required intense iteration. Here is what worked, and what failed miserably:

* **❌ Failure: Pitch-Tracking Bias.** Initially, we tried to detect if a user was looking down at a phone by tracking "Pitch" (the vertical distance between the nose and the forehead vs. the chin). **It failed.** Human faces aren't perfectly vertically symmetrical, so the algorithm was inherently biased and permanently penalized users by 40 points, dragging their score to 0 just for sitting normally!
* **✅ Success: Strict Yaw-Tracking.** We ripped out the Pitch tracking and relied exclusively on **Yaw** (the horizontal symmetry between the nose and the left/right eyes). It proved incredibly stable and accurately detects when a candidate is looking away at a second monitor.
* **❌ Failure: Deprecated Models.** Halfway through development, our backend threw a fatal `400` error on Resume Uploads. Groq had literally decommissioned the `llama3-8b-8192` model we were using! 
* **✅ Success: Upgrading to Llama-3.3.** We migrated the entire API suite to the newly released `llama-3.3-70b-versatile` model and implemented a strict JSON `response_format`, which made the AI's grading output 100x more stable and immune to conversational hallucinations.

---

## 💻 Running the Simulator Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Saurav-Gupta-13/Nexus-AI-Interview-Coach.git
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your Groq API key:
   ```env
   GROQ_API_KEY=gsk_your_api_key_here
   ```
4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser!

---
*Built with passion as an exploration into the intersection of generative AI and edge computing.*
