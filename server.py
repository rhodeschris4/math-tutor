import json
import os
from datetime import datetime, timezone
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context

from prompts import FEW_SHOT_MESSAGES, SYSTEM_PROMPT

load_dotenv()

app = Flask(__name__, static_folder="static")
client = Anthropic()
MODEL = "claude-haiku-4-5"
SESSIONS_DIR = Path(__file__).parent / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = FEW_SHOT_MESSAGES + data["messages"]

    def generate():
        with client.messages.stream(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")


@app.route("/sessions", methods=["GET"])
def list_sessions():
    sessions = []
    for f in SESSIONS_DIR.glob("*.json"):
        data = json.loads(f.read_text())
        sessions.append(
            {
                "id": data["id"],
                "title": data["title"],
                "updated_at": data["updated_at"],
            }
        )
    sessions.sort(key=lambda s: s["updated_at"], reverse=True)
    return jsonify(sessions)


@app.route("/sessions/<session_id>", methods=["GET"])
def get_session(session_id):
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return jsonify({"error": "not found"}), 404
    return jsonify(json.loads(path.read_text()))


@app.route("/sessions/<session_id>", methods=["POST"])
def save_session(session_id):
    data = request.get_json()
    data["id"] = session_id
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    (SESSIONS_DIR / f"{session_id}.json").write_text(json.dumps(data))
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
