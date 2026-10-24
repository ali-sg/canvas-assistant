# Canvas Assistant

Canvas Assistant lets the Claude desktop app **read** your Canvas courses. Ask things like "What's due this week?" and Claude answers from your actual assignments, announcements, files, grades and feedback.

It only reads. It never turns in work, posts, messages anyone or changes anything in Canvas.

This is a personal project. It has no connection to Instructure (the company behind Canvas) or to any school. So far it has only been tested with Claude on a Mac.

## What you need
Download these from the [latest release](https://github.com/ali-sg/canvas-assistant/releases/latest), under **Assets**:
- **canvas.mcpb** connects Claude to your Canvas.
- **canvas-assistant-skill.zip** teaches Claude how to sort your schoolwork.

Setup takes about 10 minutes.

## Step 1: Get the Claude app
Download Claude from [claude.ai/download](https://claude.ai/download), install it and sign in.

## Step 2: Make a Canvas key
Claude needs a key, which Canvas calls a "token", to read your Canvas.
1. In Canvas, go to **Account > Settings**.
2. Under **Approved Integrations**, click **+ New Access Token**.
3. Give it a name like "Claude" and **pick an expiry date**, such as the end of the term.
4. Click **Generate Token** and copy the code. Canvas shows it only once.

Treat this key like a password. Never share it or paste it into a chat, including with Claude. When you stop using Canvas Assistant, delete the key on that same Canvas page.

## Step 3: Install the extension
1. Double-click **canvas.mcpb**, or drag it onto the Claude window, then click **Install**.
2. Paste your key into **Canvas API token**.
3. **Canvas URL** is already filled in with LLU's address. If you're at a different school, type your school's Canvas address instead.
4. Make sure **Canvas (read-only)** is switched on.

On a Mac, a box might ask you to install "command line developer tools." That box comes from Claude, not this extension. You can click Install or Cancel.

## Step 4: Add the skill
1. In Claude, go to **Settings > Capabilities** and turn on **Code execution and file creation**. On a school or work plan, an admin may need to turn this on for you.
2. Go to **Customize > Skills**, click **+**, then **Create skill**, then **Upload a skill**.
3. Choose **canvas-assistant-skill.zip**. Don't unzip it first. Then switch the skill on.

## Step 5: Try it
Start a new chat and ask: **What's due this week?** If Claude asks for permission to use Canvas, click **Allow**.

## Things to ask
- "What's due this week?"
- "What does the syllabus say about late work?"
- "What did my instructor say about my last paper?"
- **Do my daily Canvas check-in** shows what's new, what changed and what's due soon.
- **Do my weekly Canvas sweep** lists everything due this week, biggest first.

Dates use the time zone in your Canvas profile, which you can change under **Account > Settings**.

To catch changes, Canvas Assistant keeps a small file of your course dates and grades in a hidden **.canvas-mcp** folder on your computer. Deleting that folder resets the check-ins.

## What it can look up
- **Your courses:** the classes you're enrolled in this term.
- **What's coming up:** work you haven't turned in yet that's due soon, plus anything overdue.
- **Canvas To Do list:** what Canvas itself says needs your attention.
- **Work with no due date:** assignments that don't have a date yet, sorted by module week.
- **Course details:** a course's assignments, quizzes, discussions, pages, modules, syllabus and announcements in one place.
- **Feedback:** your scores, rubric scores and instructor comments on your work.
- **Read a file:** the text of a PDF, Word or PowerPoint file in a course.
- **What changed:** anything new, changed or removed since your last check-in.
- **Announcements:** your courses' announcements.
- **Calendar:** events on your Canvas calendar.
- **Course page:** the text of one page in a course.
- **Grades:** your current grade in each course, and how it's weighted.

## Using a to-do app (optional)
You don't need one. If you use one, connect it to Claude and tell Claude which list to use. Claude can add new work and update changed due dates for you. It never checks anything off on its own, and it asks before deleting anything.

If you use Todoist, there's an extra skill for it. First connect Todoist in Claude under **Customize > Connectors**. Then upload **canvas-todoist-skill.zip** the same way you added the other skill in Step 4.

## Getting a new version
Download the new files and install them the same way you did before. Your key is kept.

## If something goes wrong
- **"Unverified extension" warning:** this is normal for extensions that don't come from a store. Only continue if you downloaded the file from this page.
- **Claude says your key is wrong or expired:** make a new key (Step 2). Then go to **Settings > Extensions > Canvas (read-only)**, paste the new key and restart Claude.
- **Claude can't see Canvas:** quit Claude completely, open it again, and check that the extension is switched on.
- **There's no Extensions or Skills option:** your school or work account may have turned it off. Try a personal Claude account.
