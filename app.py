"""
app.py
======
Flask web application for the AI-powered Interview Trainer Agent.
Routes, session management, and API endpoints are all defined here.
"""

import os
import json
import uuid
import logging
from datetime import datetime
from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, flash
)
from dotenv import load_dotenv
from interview_agent import agent

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", uuid.uuid4().hex)

# Custom Jinja2 global: enumerate(iterable) → [(0, item), (1, item), …]
app.jinja_env.globals['enumerate'] = enumerate
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"]  = "Lax"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Attempt to connect agent at startup
_agent_ready = agent.initialise()
if not _agent_ready:
    logger.warning("InterviewAgent not initialised — check .env credentials.")

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
MAX_QUESTIONS     = int(os.getenv("MAX_QUESTIONS", 20))
DEFAULT_QUESTIONS = int(os.getenv("DEFAULT_QUESTIONS", 10))

INTERVIEW_TYPES = {
    "technical": "Technical Interview",
    "hr":        "HR Interview",
    "mixed":     "Mixed (Technical + HR)",
}

DOMAINS = {
    "python":            "Python",
    "java":              "Java",
    "c":                 "C",
    "c++":               "C++",
    "javascript":        "JavaScript",
    "html":              "HTML",
    "css":               "CSS",
    "sql":               "SQL",
    "data_structures":   "Data Structures",
    "algorithms":        "Algorithms",
    "dbms":              "DBMS",
    "os":                "Operating Systems",
    "computer_networks": "Computer Networks",
    "ai":                "Artificial Intelligence",
    "machine_learning":  "Machine Learning",
    "aptitude":          "Aptitude",
    "hr":                "HR / Behavioural",
}

DIFFICULTIES = {
    "easy":   "Easy (Freshers / Beginners)",
    "medium": "Medium (1–3 years experience)",
    "hard":   "Hard (3+ years / Senior)",
}

EXPERIENCES = {
    "fresher":    "Fresher (0–1 year)",
    "experienced": "Experienced (1+ years)",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_history() -> list:
    return session.get("interview_history", [])


def _get_evaluations() -> list:
    return session.get("evaluations", [])


def _agent_check():
    """Return a JSON error if the agent isn't ready."""
    if not agent.is_ready:
        return jsonify({"error": "AI agent is not available. Check your IBM credentials in .env"}), 503
    return None


def _load_history_store() -> list:
    """Load saved interview history from the file-based store."""
    path = os.path.join("data", "interview_history.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def _save_to_history_store(report: dict):
    """Persist a completed interview report to disk."""
    path = os.path.join("data", "interview_history.json")
    os.makedirs("data", exist_ok=True)
    history = _load_history_store()
    history.insert(0, report)
    history = history[:50]          # keep last 50 reports
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)


# ---------------------------------------------------------------------------
# Routes – Pages
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Landing / home page."""
    return render_template(
        "index.html",
        interview_types=INTERVIEW_TYPES,
        domains=DOMAINS,
        difficulties=DIFFICULTIES,
        experiences=EXPERIENCES,
        default_questions=DEFAULT_QUESTIONS,
        max_questions=MAX_QUESTIONS,
        agent_ready=agent.is_ready,
    )


@app.route("/interview")
def interview():
    """Interview chat page."""
    if "session_id" not in session:
        flash("Please configure your interview settings first.", "warning")
        return redirect(url_for("index"))
    return render_template(
        "interview.html",
        session_meta=session.get("interview_meta", {}),
    )


@app.route("/report")
def report():
    """Final report page."""
    final_report = session.get("final_report")
    if not final_report:
        flash("No completed interview found.", "info")
        return redirect(url_for("index"))
    return render_template("report.html", report=final_report)


@app.route("/history")
def history():
    """Interview history page."""
    records = _load_history_store()
    return render_template("history.html", records=records)


@app.route("/history/<int:idx>")
def history_detail(idx: int):
    """View a specific historical report."""
    records = _load_history_store()
    if idx < 0 or idx >= len(records):
        flash("Report not found.", "warning")
        return redirect(url_for("history"))
    return render_template("report.html", report=records[idx], is_history=True)


# ---------------------------------------------------------------------------
# Routes – API
# ---------------------------------------------------------------------------
@app.post("/api/start")
def api_start():
    """
    Start a new interview session.
    Expected JSON body: interview_type, domain, difficulty, experience,
                        role, total_questions
    """
    # Retry initialisation in case credentials were updated after startup
    if not agent.is_ready:
        agent.initialise()
    err = _agent_check()
    if err:
        return err

    data = request.get_json(force=True) or {}

    interview_type  = data.get("interview_type", "technical")
    domain          = data.get("domain", "python")
    difficulty      = data.get("difficulty", "medium")
    experience      = data.get("experience", "fresher")
    role            = data.get("role", "Software Engineer").strip() or "Software Engineer"
    total_questions = min(int(data.get("total_questions", DEFAULT_QUESTIONS)), MAX_QUESTIONS)

    # Validate
    if interview_type not in INTERVIEW_TYPES:
        return jsonify({"error": "Invalid interview_type"}), 400
    if domain not in DOMAINS:
        return jsonify({"error": "Invalid domain"}), 400
    if difficulty not in DIFFICULTIES:
        return jsonify({"error": "Invalid difficulty"}), 400

    # Clear previous session data
    session.clear()
    session["session_id"] = str(uuid.uuid4())
    session["interview_meta"] = {
        "interview_type":  interview_type,
        "domain":          domain,
        "difficulty":      difficulty,
        "experience":      experience,
        "role":            role,
        "total_questions": total_questions,
        "started_at":      datetime.utcnow().isoformat() + "Z",
    }
    session["interview_history"] = []
    session["evaluations"]       = []
    session["question_count"]    = 0
    session["current_question"]  = None

    try:
        first_msg = agent.generate_first_question(session["interview_meta"])
        session["current_question"] = first_msg
        session["question_count"]   = 1
        history = _get_history()
        history.append({"role": "interviewer", "content": first_msg})
        session["interview_history"] = history
        return jsonify({"message": first_msg, "question_number": 1, "total": total_questions})
    except Exception as exc:
        logger.error("api_start error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.post("/api/answer")
def api_answer():
    """
    Submit a candidate's answer, receive evaluation and next question.
    Expected JSON body: answer (string)
    """
    err = _agent_check()
    if err:
        return err

    if "session_id" not in session:
        return jsonify({"error": "No active session. Please start an interview first."}), 400

    data   = request.get_json(force=True) or {}
    answer = data.get("answer", "").strip()

    if not answer:
        return jsonify({"error": "Answer cannot be empty."}), 400

    meta              = session.get("interview_meta", {})
    history           = _get_history()
    evaluations       = _get_evaluations()
    question_count    = session.get("question_count", 1)
    current_question  = session.get("current_question", "")
    total_questions   = meta.get("total_questions", DEFAULT_QUESTIONS)

    # Append candidate answer to history
    history.append({"role": "candidate", "content": answer})

    try:
        # Evaluate the answer
        evaluation = agent.evaluate_answer(current_question, answer, meta)
        evaluations.append(evaluation)

        # Build response payload
        payload = {
            "evaluation":      evaluation,
            "question_number": question_count,
            "total":           total_questions,
        }

        # Determine next step — is_last checked FIRST so it always wins
        follow_up = evaluation.get("follow_up_question")
        is_last   = question_count >= total_questions

        if is_last:
            # Interview complete — generate report
            report = agent.generate_final_report(meta, history, evaluations)
            report["session_id"]      = session.get("session_id")
            report["interview_type"]  = meta.get("interview_type")
            report["domain"]          = meta.get("domain")
            report["role"]            = meta.get("role")
            session["final_report"]   = report
            _save_to_history_store(report)
            payload["is_last"]        = True
            payload["redirect_url"]   = url_for("report")

        elif follow_up:
            # Follow-up counts as the next question slot
            next_q_num  = question_count + 1
            next_msg    = follow_up
            payload["next_question"] = next_msg
            payload["is_follow_up"]  = True
            payload["is_last"]       = False
            session["current_question"] = next_msg
            session["question_count"]   = next_q_num
            history.append({"role": "interviewer", "content": next_msg})

        else:
            # Advance to next question
            next_q_num = question_count + 1
            next_msg   = agent.generate_next_question(meta, history, next_q_num)
            payload["next_question"] = next_msg
            payload["is_follow_up"]  = False
            payload["is_last"]       = False
            session["current_question"] = next_msg
            session["question_count"]   = next_q_num
            history.append({"role": "interviewer", "content": next_msg})

        # Persist session state
        session["interview_history"] = history
        session["evaluations"]       = evaluations

        return jsonify(payload)

    except Exception as exc:
        logger.error("api_answer error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.get("/api/status")
def api_status():
    """Health-check endpoint."""
    return jsonify({
        "agent_ready": agent.is_ready,
        "active_session": "session_id" in session,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })


@app.post("/api/end")
def api_end():
    """Force-end an interview early and generate a partial report."""
    err = _agent_check()
    if err:
        return err

    if "session_id" not in session:
        return jsonify({"error": "No active session."}), 400

    meta        = session.get("interview_meta", {})
    history     = _get_history()
    evaluations = _get_evaluations()

    if not evaluations:
        session.clear()
        return jsonify({"redirect_url": url_for("index")})

    try:
        report = agent.generate_final_report(meta, history, evaluations)
        report["session_id"]     = session.get("session_id")
        report["early_end"]      = True
        session["final_report"]  = report
        _save_to_history_store(report)
        return jsonify({"redirect_url": url_for("report")})
    except Exception as exc:
        logger.error("api_end error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.delete("/api/history/<int:idx>")
def api_delete_history(idx: int):
    """Delete a specific history entry."""
    records = _load_history_store()
    if idx < 0 or idx >= len(records):
        return jsonify({"error": "Index out of range"}), 404
    records.pop(idx)
    path = os.path.join("data", "interview_history.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="Page not found."), 404


@app.errorhandler(500)
def server_error(e):
    return render_template("error.html", code=500, message="Internal server error."), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
