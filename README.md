# MathMentor

AI math tutor for high school students. Uses the Socratic method, guides students through problems with questions instead of giving answers directly.

Built with Claude (Haiku), Flask, and vanilla JS. Math rendered with KaTeX.

## Setup

Requires Python 3.10+ and an Anthropic API key.

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your Anthropic API key to .env
```

## Run

```bash
python server.py
```

Open http://localhost:5000.

## How it works

Three-panel layout: session sidebar, chat, and a workspace with the current problem and step tracker.

The frontend sends the full message history to `/chat` on each turn. The server prepends a system prompt (with few-shot examples and chain-of-thought instructions) and streams the response back from Claude Haiku. KaTeX auto-render handles `$...$` and `$$...$$` in responses.

Sessions persist as JSON files in `sessions/`.

### Prompting

Three techniques layered together:

- **System prompt** -- defines the tutor persona, Socratic constraints, and response format rules
- **Few-shot examples** -- demonstrate the exact coaching rhythm (ask, affirm, nudge)
- **Chain-of-thought** -- instructs the model to solve the problem internally before responding, so guidance is accurate without revealing the full solution

### Quick actions

Pill buttons above the input send prebuilt prompts: "Hint", "Show Step", and "Explain Again". These give students structured ways to ask for help without having to articulate what they need.

## File structure

```
server.py          Flask app, all routes
prompts.py         System prompt and few-shot examples
static/
  index.html       Three-panel layout
  style.css        Styles, color variables in :root
  app.js           Chat logic, streaming, session management
sessions/          Persisted session JSON files (created at runtime)
```

## Design decisions

- **Claude Haiku over a local model** -- faster iteration, better instruction following for Socratic constraints
- **Full history per request** -- no summarization or context management needed for typical 3-5 exchange sessions (future addition would be to compress the conversation if it becomes too lengthy)
- **Streaming via SSE** -- responses appear incrementally, feels more natural for a tutoring conversation
- **No build step** -- vanilla HTML/CSS/JS, KaTeX from CDN. Nothing to compile.

## What I would improve with more time

- Integrate vision ie uploading handwritten math problem
- ElevenLabs text to speech on tutor responses
- Evaluation metrics (correct answer rate, hint usage)
- Practice mode that generates follow up problems
