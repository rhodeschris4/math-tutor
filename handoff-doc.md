# MathMentor — Full Project Handoff Document

## Context

This is a take-home project for an AI Engineering internship interview. The task is to build an AI-powered coaching assistant that helps high school students work through math problems. The assistant should guide students toward understanding (Socratic method) rather than giving direct answers. Time estimate is 2-4 hours. Deliverables: working code, README, and 3-5 example conversations.

We chose **math tutoring** as the focus area.

---

## Architecture Overview

### Core Stack

- **LLM:** Llama 7B running locally (via Ollama or llama.cpp)
- **Vision Model:** LLaVA 7B (or MiniCPM-V / Moondream as lighter alternatives) — for reading uploaded images of handwritten math work
- **Frontend:** Web app generated via Google Stitch, then refined manually. HTML/CSS/JS.
- **Math Rendering:** KaTeX (preferred over MathJax — faster and lighter) for rendering LaTeX math notation in the browser
- **Text-to-Speech:** ElevenLabs API for a "Read Aloud" feature on tutor responses
- **Backend:** Whatever language you're comfortable with (Python is simplest for local LLM integration)

### How the Pieces Connect

```
Student types/uploads → Frontend → Backend API
                                      ├── Text input → Llama 7B (with conversation history)
                                      ├── Image upload → LLaVA (extract math) → text fed to Llama as context
                                      └── "Read Aloud" button → ElevenLabs API → audio played in browser

Llama response → Backend → Frontend
                              ├── Math expressions detected → rendered with KaTeX
                              ├── Workspace panel updated (current problem, step tracker)
                              └── Conversation appended to history
```

---

## Multi-Turn Conversation Management

### How It Works

Llama has no memory between calls. Context is maintained by sending the full message history with each request:

```python
messages = [
    {"role": "system", "content": "<system prompt>"},
    {"role": "user", "content": "Help me solve 2x + 5 = 15"},
    {"role": "assistant", "content": "Let's start by isolating..."},
    {"role": "user", "content": "So I subtract 5?"},
    # ... new message appended here
]
```

Every new student message gets appended, and the entire array is sent to the model.

### Context Window Strategy

Llama 7B typically has a 4096-8192 token context window. For the spec's requirement of 3-5 exchanges, this is plenty. For longer conversations:

1. Monitor token count of the full message array
2. When approaching the limit (~80% of context window), take older messages and summarize them:
   - Send older messages to Llama with prompt: "Summarize this tutoring session so far in 2-3 sentences. Include the problem being worked on and what progress has been made."
   - Replace older messages with the summary
3. New context becomes: system prompt → summary → recent messages

The student never sees this happening.

### Session Persistence (Nice-to-Have)

Store message arrays as JSON files or in a lightweight database (SQLite), keyed by session ID. The left sidebar lists saved sessions. When a student returns to a session, load the message history and continue. This is a nice-to-have feature — implement only if time allows after core functionality works.

---

## Prompting Strategy

Use **three techniques layered together** (the spec asks for at least one):

### 1. System Prompt

The system prompt defines the tutor's personality, approach, and constraints. It should instruct the model to:
- Act as a friendly, patient math tutor for high school students
- Use the Socratic method — ask guiding questions, don't give answers directly
- Work through problems step by step
- Internally solve the problem first (chain-of-thought), then decide what guidance to give based on where the student is
- Output math expressions in LaTeX delimiters (e.g., `$...$` for inline, `$$...$$` for block) so the frontend can render them with KaTeX
- Be encouraging and supportive — celebrate small wins, normalize mistakes
- Stay on topic — if the student asks something unrelated to math, gently redirect
- When a student is stuck, offer graduated help: first a nudge, then a bigger hint, then a worked partial example

### 2. Few-Shot Examples

Include 2-3 example interactions inside the system prompt that demonstrate the desired coaching style:

**Example pattern to include:**
```
Student: "What's the answer to 2x + 5 = 15?"
Tutor: "Great question! Let's work through this together. Look at the equation — what operation is being done to x? What might we do first to start isolating it?"

Student: "Subtract 5 from both sides?"
Tutor: "Exactly right! ✓ So if we subtract 5 from both sides, what do we get? Try writing it out."

Student: "2x = 10"
Tutor: "Perfect! Now we have 2x = 10. We're almost there — what's the last step to get x by itself?"
```

These examples teach the model the exact tone and rhythm you want — guiding without giving answers, affirming correct steps, prompting the student to do the work.

### 3. Chain-of-Thought Instruction

In the system prompt, include an instruction like:

> "Before responding to the student, silently solve the problem yourself in full. Identify what step the student is currently on, what the next logical step would be, and what common mistakes students make at this point. Then craft your response to guide them to the next step without revealing the full solution. Do not show your internal reasoning to the student."

This ensures the model has the full solution in its working memory so it can give accurate, contextual guidance rather than generic encouragement.

### Key System Prompt Requirements
- Output math in LaTeX delimiters for KaTeX rendering
- Keep responses concise (2-4 sentences typically) — students lose focus on walls of text
- Use emoji sparingly but warmly (✓ for correct steps, 💡 for hints)
- When the student completes the problem, give a brief congratulatory message and offer to try a similar problem for practice

---

## Image Upload Pipeline

### Purpose
Students can take a photo of handwritten math (homework, textbook, whiteboard) and upload it. The app extracts the math and starts a tutoring session around it.

### Technical Flow

1. Student drops/selects an image in the upload area
2. Frontend sends the image to the backend
3. Backend sends the image to the vision model (LLaVA) with a prompt like:
   > "Extract all math equations, expressions, and problems from this handwritten image. Output them in LaTeX format. If you can identify what type of problem it is (linear equation, quadratic, system of equations, etc.), state that as well."
4. LLaVA returns the extracted math as text
5. That extracted text is injected into the conversation as context for Llama:
   > "The student uploaded an image of their work. Here is what was extracted: [LaTeX math]. Help them work through this problem."
6. Frontend shows the uploaded image in the chat, then displays the tutor's interpretation with a confirmation prompt: "Here's what I read from your work — does this look right?" with "Yes, that's right" / "Let me correct it" buttons
7. The workspace panel on the right updates with the current problem and generates solution steps

### Fallback
If the vision model can't read the handwriting or is uncertain, the tutor should say so honestly and ask the student to type the problem instead. Don't hallucinate math that isn't there.

---

## ElevenLabs Text-to-Speech Integration

### Purpose
A "Read Aloud" button in the workspace sidebar that reads the tutor's most recent response aloud. This serves accessibility (auditory learners, students with reading difficulties) and makes the tutoring feel more personal.

### Implementation
- Use the ElevenLabs API to convert the tutor's text response to audio
- Strip LaTeX delimiters before sending to ElevenLabs (send the plain-language version of math, e.g., "x equals negative b plus or minus the square root of b squared minus 4ac, all over 2a")
- Play the audio in the browser using the Web Audio API or a simple `<audio>` element
- Use a warm, friendly voice from ElevenLabs' voice library

### Priority
This is a **nice-to-have** feature. Get the core tutoring conversation working first. Add this last if time permits. It's a strong differentiator for the interview but not worth sacrificing core functionality.

---

## UI Layout & Design

### Design Philosophy
The app should feel like a tutoring workspace, not a generic chatbot. The key differentiator is the three-panel layout with a dedicated workspace — this demonstrates product thinking beyond "I wrapped an LLM in a chat bubble."

### Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Royal Blue | #083D77 | Left sidebar background, primary buttons, tutor message accent bars |
| Deep Navy Slate | #2E4057 | Headings, body text, sidebar hover states |
| Vibrant Coral Rose | #DA4167 | CTA buttons ("New Session"), active stepper dots, important highlights |
| Bright Golden Yellow | #F4D35E | Progress indicators, completed checkmarks, hint button backgrounds |
| Warm Peach Sand | #F6D8AE | Student message backgrounds, hover glows, subtle card tints |
| Off-White | #FAFAF8 | Main page background |
| White | #FFFFFF | Cards and panels |

### Three-Panel Layout

**Left Sidebar (~240px, royal blue background):**
- App logo "MathMentor" with owl mascot icon
- "New Session" button (coral, prominent)
- List of previous sessions with titles, dates, and subject tags
- Settings and Help links at bottom

**Center Panel (flexible width, main conversation area):**
- Session header at top: title + subtitle + three-dot menu
- Conversation messages:
  - Tutor messages: white cards with left accent bar in royal blue, owl avatar icon
  - Student messages: right-aligned with warm peach (#F6D8AE) background
  - Math expressions rendered inline with KaTeX
- Quick-action pill buttons above input: "💡 Hint", "👁 Show Step", "🔄 Explain Again"
- Input bar: "+" attachment button, text field, coral send button

**Right Sidebar — Workspace (~320px):**
- "Current Problem" card with the math problem in large KaTeX-rendered text
- "Solution Steps" vertical stepper/tracker:
  - Completed steps: green checkmark with golden yellow
  - Current step: coral numbered dot with highlighted background
  - Upcoming steps: gray, muted
- "Upload Your Work" dropzone with dashed border
- "Read Aloud" button at bottom (ElevenLabs integration)

### Three Key Screens
1. **Welcome/Empty State** — "What are you working on today?" with topic cards (Algebra, Geometry, Pre-Calculus), simplified Quick Tips in right sidebar
2. **Active Tutoring Session** — Full three-panel layout, mid-conversation with workspace populated
3. **Image Upload Flow** — Shows uploaded photo in chat, tutor's extracted math with confirmation buttons ("Yes, that's right" / "Let me correct it")

### Responsive Behavior
On smaller screens, the right workspace sidebar collapses into a toggleable drawer.

### UI Generation
Initial UI was generated using Google Stitch (stitch.withgoogle.com) and refined with follow-up prompts. Stitch outputs HTML + TailwindCSS which can be used as the starting point for the frontend. The Stitch prompt and refinement prompts are available separately.

---

## Key Technical Decisions to Explain in Walkthrough

These are decisions the interviewer will likely ask about:

1. **Why local Llama instead of a free API?** — Shows deeper technical understanding, no rate limit concerns during demo, demonstrates ability to work with local model infrastructure
2. **Why three prompting techniques?** — They asked for at least one; layering system prompt + few-shot + chain-of-thought shows you understand they're complementary, not alternatives
3. **Why the split-panel workspace?** — Product thinking. A chat-only interface is generic. The workspace makes math tutoring feel purposeful and shows progress visually.
4. **Why KaTeX over MathJax?** — Faster rendering, smaller bundle size, better for a responsive web app
5. **Why a separate vision model for images?** — Llama 7B is text-only. Orchestrating multiple models shows architectural thinking.
6. **Why conversation summarization for context management?** — Shows awareness of context window limitations and a practical solution

---

## Build Priority Order

Given the 2-4 hour time constraint, build in this order:

1. **System prompt + basic conversation loop** — Get Llama responding in the Socratic coaching style with few-shot examples and chain-of-thought. Test in terminal first.
2. **Multi-turn context management** — Implement the message history array. Verify it maintains context across 3-5 exchanges.
3. **Frontend with KaTeX** — Hook up the Stitch-generated UI. Get messages rendering with proper math formatting.
4. **Image upload + vision model** — Wire up LLaVA for handwriting extraction. This is the wow factor.
5. **Quick-action buttons** — "Hint", "Show Step", "Explain Again" send pre-defined prompts to the model.
6. **ElevenLabs Read Aloud** — Add last if time permits.
7. **Session persistence** — Save/load conversations. Only if time permits.

---

## Deliverables Checklist

- [ ] Clean, commented code with clear structure
- [ ] README with: setup instructions, approach explanation, design decisions, what you'd improve
- [ ] 3-5 example conversations demonstrating the Socratic tutoring style
- [ ] Working demo for the walkthrough call
- [ ] (Bonus) Stitch mockups showing the UI design process

---

## What to Say You'd Improve With More Time

- Add evaluation metrics (track if students reach correct answers, measure hint usage)
- Implement guardrails for off-topic questions (the system prompt handles basic redirection, but a classifier would be more robust)
- Add streaming responses so the tutor's messages appear word-by-word
- Build out the session persistence with a proper database
- Add a "practice mode" that generates similar problems after a student completes one
- Fine-tune the model on math tutoring conversations for better domain performance
- Add support for graphing (plot equations visually in the workspace)
