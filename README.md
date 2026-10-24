# Canvas Assistant

A free add-on for the Claude desktop app that lets Claude **read** your Canvas courses and help you keep track of assignments, due dates, announcements, course files, grades and feedback. It is **read-only**: it never turns in work, posts, messages anyone, or changes anything in Canvas.

This is an independent personal project. It is not affiliated with, endorsed by, or supported by Instructure (the company that makes Canvas) or by any school.

Download the files from the [Releases page](https://github.com/ali-sg/canvas-assistant/releases). The setup guide is below.

---

## Canvas for Claude: Setup Guide

This lets the Claude app **read** your Canvas courses, so you can ask things like "What's due this week?" It can only look. It never turns in work, posts, messages anyone, or changes anything in Canvas.

You'll need these two files. Download them from the **Releases** page at **https://github.com/ali-sg/canvas-assistant/releases** (under **Assets** on the newest release). Only download them from there:
- **canvas.mcpb**: connects Claude to your Canvas account
- **canvas-assistant-skill.zip**: teaches Claude how to find and sort your schoolwork

**Optional: check that the files weren't changed.** The Releases page also has **SHA256SUMS.txt**, a list of fingerprints for the files. To compare: on a Mac, open **Terminal**, type `shasum -a 256 ` (with a space at the end), drag the downloaded file into the window and press Return. On Windows, open **PowerShell** and type `Get-FileHash ` followed by the file's path. The long code it prints should match the line for that file in SHA256SUMS.txt (capital or small letters don't matter). If it doesn't, don't use the file.

Setup takes about 10 minutes.

So far this has only been tested with the Claude desktop app on macOS.

## Step 1: Get the Claude app
1. Go to **https://claude.ai/download** and download Claude for your Mac or Windows computer.
2. Install it the way you'd install any other app, open it, and sign in.

## Step 2: Make a Canvas key (called a "token")
Claude needs a key that lets it read your Canvas.

1. Sign in to Canvas in your web browser.
2. Click **Account**, then **Settings**.
3. Scroll to **Approved Integrations** and click **+ New Access Token**.
4. For **Purpose**, type something like "Claude". For **Expires**, **always pick a date**, such as the last day of the term.
5. Click **Generate Token**.
6. Copy the long code it shows you. **Canvas only shows it once**, so leave that page open until you finish Step 3.

Treat the token like a password. Don't share it, post it, or paste it into a chat with anyone, including Claude.

**Good to know:** a Canvas token can do anything you can do in Canvas, such as submit work or send messages. This extension only uses it to read. When you stop using the extension, delete the token: in Canvas, go to **Account > Settings > Approved Integrations** and click the trash can next to it.

## Step 3: Connect Canvas to Claude
1. Find **canvas.mcpb** (it's probably in your Downloads folder) and **double-click** it. Claude opens and asks whether to install it.
   - If double-clicking doesn't work, drag the file onto the Claude window instead.
   - Or, in Claude, go to **Settings > Extensions > Advanced settings > Install Extension…** and choose the file.
2. Click **Install**.
3. Paste your token into the **Canvas API token** box.
4. The address that's filled in for **Canvas URL** is LLU's (`https://llu.instructure.com`). If your school is different, type your school's Canvas address instead, for example `https://yourschool.instructure.com`.
5. Make sure the switch next to **Canvas (read-only)** is turned **on**.

Claude keeps your token locked in your computer's secure storage.

On a Mac, Claude may show Apple's "install command line developer tools" box. It comes from Claude, not this extension. You can click Install (it's Apple's) or Cancel.

## Step 4: Add the skill
Skills work on every Claude plan. First, turn on the setting that skills need:
- **Free, Pro or Max plan:** go to **Settings > Capabilities** and turn on **Code execution and file creation**.
- **Team or Enterprise plan (through your school or work):** an owner of your organization has to turn this on under **Organization settings > Plugins & skills > Policy** (both **Code execution and file creation** and **Skills**). It's usually already on for Team plans. If you don't see it, ask them.

Then upload the skill:
1. In Claude, go to **Customize > Skills**.
2. Click **+**, then **Create skill**, then **Upload a skill**.
3. Choose **canvas-assistant-skill.zip**. Don't unzip it first.
4. Turn on the **canvas-assistant** skill with its switch.

**Only if you can't upload skills** (for example, your organization turned it off): unzip the file, open the `canvas-assistant` folder, open `SKILL.md` with a text app (TextEdit on Mac, Notepad on Windows), copy everything, and paste it into a Claude **Project**'s instructions. Then chat inside that Project.

## Step 5: Try it
Start a new chat and type:

**What's due this week?**

The first time, Claude may ask permission to use Canvas. Choose **Allow**. You'll get your upcoming work from Canvas.

Dates are shown in the time zone from your Canvas profile. To change it, go to Canvas **Account > Settings** and edit **Time Zone**.

## What else you can ask
- **Course files:** "What does the syllabus PDF say about late work?" Claude can read PDFs, Word and PowerPoint files you can open in Canvas. It reads them without saving a copy. Some files it can't read (pictures, spreadsheets, very large files over 20 MB, or links to other websites); it will list those so you can open them yourself.
- **Feedback:** "What did my instructor say about my last paper?" Claude can show your score, your rubric scores and comments from your instructors and TAs. It leaves out comments from anyone else.
- **Your Canvas To Do list:** "What's on my Canvas To Do list?"

## Daily and weekly check-ins
Claude can keep an eye on Canvas for you. Copy and paste one of these into a new chat:

- Every evening: **Do my daily Canvas check-in**
- Every Monday morning: **Do my weekly Canvas sweep**

The daily check-in tells you what's new or changed, what just opened up, announcement highlights, anything due in the next two days that you haven't turned in (including your Canvas To Do list), and new grades with your instructor's comments. If nothing has changed and nothing is urgent, it just says so in one line. **The first daily check-in saves a starting point** and shows what's due soon. It has nothing to compare yet, so changes show up from the second one on.

**What gets saved on your computer:** to spot changes, the extension keeps one file in a **.canvas-mcp** folder in your home folder. It holds course and assignment names, dates, calendar event locations, and your own scores and grades. Text like assignment descriptions and pages is saved only as scrambled fingerprints (hashes), not as readable text. Only your computer account can read it. To reset it, delete the **.canvas-mcp** folder; the next check-in starts fresh. (On a Mac, the folder is hidden: in Finder, open your home folder and press **Command-Shift-.** to show it.)

The weekly sweep lists everything due from Monday through Sunday night, ranked from biggest to smallest, plus deadlines it found on course pages, in announcements, in the syllabus or in course files like the syllabus PDF.

Both only look at Canvas. They never turn in work or message anyone.

**Making them run on their own (paid plans only).** Claude can repeat a request on a schedule:
- In a chat, type something like **Every day at 7 PM, do my daily Canvas check-in**, answer any questions Claude asks, check the name and schedule it suggests, then click **Schedule**. Do the same with **Every Monday at 8 AM, do my weekly Canvas sweep**.
- If you see **Chat** and **Cowork** options in Claude, use Cowork: click **Scheduled** in the left sidebar, click **New task**, then **Create with Claude**, and describe the check-in and when it should run.
- You can see, pause or delete them anytime under **Scheduled** in the left sidebar.

Scheduled tasks run in the cloud and may not be able to use the Canvas connection on your computer. Check the first run. If it says it can't reach Canvas, or you're on the free plan, paste the prompt yourself each evening and each Monday morning.

Times follow the time zone in your Canvas profile, so make sure it's right: in Canvas, go to **Account > Settings** and check **Time Zone**.

## Do I need a to-do app?
No. Canvas and Claude are your list. A simple routine:
- **Every evening:** do your daily check-in.
- **Monday morning:** do your weekly sweep and work from its ranked list.
- **Anytime:** ask Claude, like "What's due this week?"

If you already use a to-do app (Apple Reminders, Google Tasks, Todoist, etc.), you can copy items over from the check-in, or connect the app to Claude. Tell Claude which list to use. It can keep that list in sync with Canvas on its own: adding new work and updating changed due dates. It never checks anything off for you, and it asks before deleting.

**Optional: the Todoist skill.** If you use Todoist, there's a second skill that sets up your Todoist list the same careful way. First connect Todoist in Claude: go to **Customize > Connectors**, click **+** next to Connectors (or in a chat: **+ > Connectors > Manage connectors**), find **Todoist**, click **Connect** and sign in, then open a new chat. Then upload **canvas-todoist-skill.zip** the same way as the Canvas skill in Step 4. The first time, Claude will ask you a few setup questions (which project to use, one section per course or not, and so on).

## Updating from the old version
If you already set this up and got new files:
1. Double-click the new **canvas.mcpb** and click **Install** (or **Update**). Your token is kept; if Claude asks for it again, paste it in.
2. Upload the new **canvas-assistant-skill.zip** the same way as in Step 4. If Claude says a skill with that name already exists, choose to replace it, or delete the old **canvas-assistant** skill first and then upload the new one.
3. Quit Claude completely and open it again.

**New in version 0.4.4:** more safety fixes. Hidden code in Canvas pages can no longer slip into the text Claude reads, the saved changes file no longer forgets a course after a hiccup loading your course list (or right after you asked about that course), and file reading runs without access to your token. Very long pages are read from their first 2 MB. Install the new **canvas.mcpb** (step 1 above). Your token and Canvas URL are kept. Re-uploading the skills is optional. (A known issue in one of the building blocks, zod, isn't practically reachable here: every list you can pass in is size-capped before it's checked. Moving to zod's next major version is planned.)

**New in version 0.4.3:** safety fixes. Reading files is faster and safer, Canvas addresses with extra parts after them are refused, and Claude now treats text in Canvas as information, not instructions. Install the new **canvas.mcpb** and re-upload **canvas-assistant-skill.zip** (and **canvas-todoist-skill.zip** if you use it). Your token and Canvas URL are kept.

**New in version 0.4.2:** the project has a new home, **https://github.com/ali-sg/canvas-assistant**, and the Canvas URL setting has a simpler description. Install the new **canvas.mcpb** (step 1 above). Your token and Canvas URL are kept. Re-uploading the skills is optional.

**New in version 0.4.1:** only the author details and this guide changed. Install the new **canvas.mcpb** (step 1 above). Re-uploading the skills is optional. New files are always on the Releases page: **https://github.com/ali-sg/canvas-assistant/releases**.

**New in version 0.4.0: three tools have new names.** Nothing else changes in how you use it.
- "todo_list" is now **canvas_todo_items**
- "my_feedback" is now **assignment_feedback**
- "course_snapshot" is now **course_details**

To get the new names, double-click the new **canvas.mcpb** and re-upload the new **canvas-assistant-skill.zip** (steps 1 to 3 above). Use both new files together: the old skill won't work with the new extension, or the other way around.

## If something goes wrong
- **A warning says the extension is "unverified" or not signed:** this is normal for files shared directly rather than through a store. Continue only if you downloaded it from the Releases page above.
- **Claude says your token is wrong, expired, or it can't sign in to Canvas (it may mention "401"):** your token was mistyped, has expired, or was deleted. Make a new one (Step 2). Then in Claude go to **Settings > Extensions**, click **Canvas (read-only)**, paste the new token, and quit and reopen Claude.
- **There's no Extensions option, or installing is blocked:** your school or organization has turned extensions off on this computer or account. Ask your IT help desk or admin, or use a personal computer or personal Claude account.
- **The Skills section is missing or greyed out:** the setting in Step 4 is off.
- **Claude doesn't seem to see Canvas:** quit Claude completely (not just close the window), open it again, and check that **Canvas (read-only)** is switched on in **Settings > Extensions**.
- **Times look off:** check the time zone in your Canvas profile (**Account > Settings**).
- **If it still won't start,** or something else looks wrong, check or open an issue at **https://github.com/ali-sg/canvas-assistant/issues**. Describe what happened, but never include your Canvas token.
