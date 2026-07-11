# Interview Trainer Agent

> **AI-powered interview preparation platform** built with Python Flask and IBM watsonx.ai (IBM Granite models).

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Interview Types** | Technical, HR, Mixed |
| **Domains** | Python, Java, C, C++, JavaScript, HTML, CSS, SQL, Data Structures, Algorithms, DBMS, OS, Networks, AI, ML, Aptitude |
| **Experience Levels** | Fresher (0–1 yr) & Experienced (1+ yrs) |
| **Difficulty Levels** | Easy, Medium, Hard |
| **AI Evaluation** | Score (0–10), strengths, weaknesses, ideal answer per question |
| **Follow-up Questions** | AI generates follow-ups based on your answers |
| **Final Report** | Overall score, grade, recommendations, hiring verdict, charts |
| **Interview History** | Persist & review past sessions |
| **Dark Mode** | System-aware + toggle |
| **Mobile Responsive** | Bootstrap 5 + custom CSS |

---

## 🏗 Project Structure

```
Interview Trainer Agent/
├── app.py                  # Flask application & API routes
├── interview_agent.py      # Core AI agent (watsonx.ai / Granite)
├── requirements.txt
├── .env.example            # Environment variable template
├── data/
│   ├── sample_questions.json   # Reference question bank
│   └── interview_history.json  # Persisted session history (auto-created)
├── templates/
│   ├── base.html           # Master layout
│   ├── index.html          # Home / configuration page
│   ├── interview.html      # Live chat interview page
│   ├── report.html         # Final report + charts
│   ├── history.html        # Session history dashboard
│   └── error.html          # 404 / 500 error page
└── static/
    ├── css/style.css       # Full stylesheet (light + dark + animations)
    ├── js/main.js          # Dark mode, toasts, utilities
    └── js/interview.js     # Interview chat controller
```

---

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.10+
- An [IBM Cloud account](https://cloud.ibm.com/registration)
- A [watsonx.ai project](https://cloud.ibm.com/catalog/services/watson-studio) with the IBM Granite model enabled

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd "Interview Trainer Agent"

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
IBM_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct
FLASK_SECRET_KEY=a_long_random_string_here
```

### 4. Run Locally

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 🔑 Getting IBM Credentials

### IBM Cloud API Key
1. Go to [IBM Cloud IAM](https://cloud.ibm.com/iam/apikeys)
2. Click **Create an IBM Cloud API key**
3. Copy and save it — it's shown only once

### watsonx.ai Project ID
1. Open [IBM watsonx.ai](https://dataplatform.cloud.ibm.com/wx/)
2. Create or open a project
3. Go to **Manage → General** and copy the **Project ID**

### Supported Granite Models
| Model ID | Notes |
|---|---|
| `ibm/granite-3-3-8b-instruct` | ✅ Recommended — fast & capable |
| `ibm/granite-3-8b-instruct` | Balanced |
| `ibm/granite-13b-instruct-v2` | Higher quality, slower |

---

## 🐋 Docker Deployment

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
```

```bash
# Build and run
docker build -t interview-trainer .
docker run -p 5000:5000 --env-file .env interview-trainer
```

---

## ☁ IBM Code Engine Deployment

```bash
# Install IBM Cloud CLI + Code Engine plugin
ibmcloud login
ibmcloud ce project create --name interview-trainer
ibmcloud ce app create \
  --name interview-trainer \
  --image us.icr.io/your-namespace/interview-trainer:latest \
  --env-from-secret interview-trainer-secrets \
  --port 5000
```

---

## ⚙ Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `IBM_API_KEY` | ✅ | — | IBM Cloud API Key |
| `WATSONX_PROJECT_ID` | ✅ | — | watsonx.ai Project ID |
| `WATSONX_URL` | | `https://us-south.ml.cloud.ibm.com` | watsonx.ai endpoint |
| `WATSONX_MODEL_ID` | | `ibm/granite-3-3-8b-instruct` | Granite model ID |
| `FLASK_SECRET_KEY` | ✅ | random UUID | Flask session key |
| `FLASK_DEBUG` | | `False` | Enable debug mode |
| `MAX_QUESTIONS` | | `20` | Max questions per session |
| `DEFAULT_QUESTIONS` | | `10` | Default question count |

---

## 🧩 Customising the Agent

All AI behaviour is controlled by constants at the top of [`interview_agent.py`](interview_agent.py) inside the **`AGENT_INSTRUCTIONS`** section:

| Constant | What it controls |
|---|---|
| `INTERVIEWER_PERSONA` | Name, backstory, and character of the AI |
| `TONE_STYLE` | Communication style — encouraging, strict, formal |
| `EVALUATION_CRITERIA` | Scoring rubric (0–10 scale) |
| `SAFETY_RULES` | Topics to refuse, conduct guardrails |
| `FEEDBACK_STYLE` | Structure and depth of per-answer feedback |
| `FOLLOW_UP_STRATEGY` | When and how to ask follow-up questions |
| `DIFFICULTY_PROMPTS` | Extra instructions per difficulty level |
| `DOMAIN_CONTEXT` | Domain-specific interviewing hints |

---

## 🔒 Security

- API keys are loaded from `.env` — never hardcoded
- `.env` is in `.gitignore` — never committed
- Flask sessions use HTTPONLY cookies
- All user input is HTML-escaped before rendering
- Content Security Policy headers can be added via Flask-Talisman for production

---

## 📄 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/start` | Start interview session |
| `POST` | `/api/answer` | Submit answer, get evaluation + next question |
| `GET` | `/api/status` | Health check |
| `POST` | `/api/end` | End interview early |
| `DELETE` | `/api/history/<idx>` | Delete history entry |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

*Built with ❤ using IBM Granite on watsonx.ai*
