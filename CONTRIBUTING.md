# Contributing to NIA Excellence Hub

## First-Time Setup

### 1. Prerequisites

Install these on your machine (macOS):

- **Git** — `xcode-select --install` (includes Git)
- **Node.js v24** — download from https://nodejs.org
- **GitHub CLI** — `brew install gh` then `gh auth login`
- **Claude Code** (optional) — `npm install -g @anthropic-ai/claude-code`

### 2. Clone the Repo

```bash
git clone https://github.com/thenia-org/nia-results-tracker.git
cd nia-results-tracker
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Environment Variables

Get the `.env.local` file from Jon (don't share over email or Slack — use a password manager or in person).

Place it in the project root:

```
nia-results-tracker/
  .env.local    <-- here
  CLAUDE.md
  package.json
  ...
```

### 5. Run the Dev Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser. You should see the NIA Excellence Hub.

## Daily Workflow

### Making Changes

1. **Start from main:**
   ```bash
   git checkout main
   git pull
   ```

2. **Create a branch:**
   ```bash
   git checkout -b yourname/short-description
   ```
   Examples: `sarah/add-reports-page`, `sarah/fix-login-bug`

3. **Make your changes, then commit:**
   ```bash
   git add <files>
   git commit -m "Short description of what you changed"
   ```

4. **Push your branch:**
   ```bash
   git push -u origin yourname/short-description
   ```

5. **Open a Pull Request:**
   ```bash
   gh pr create
   ```
   Or go to GitHub and click the "Compare & pull request" button.

6. **Merge when ready:**
   ```bash
   gh pr merge
   ```
   Or click "Merge pull request" on GitHub. This triggers an automatic deploy to production.

7. **Clean up:**
   ```bash
   git checkout main
   git pull
   git branch -d yourname/short-description
   ```

### Important Rules

- **Never push directly to `main`** — always use a PR
- **Pull `main` before creating a branch** — keeps you up to date
- **Keep branches short-lived** — merge within a day or two to avoid conflicts

## Project Structure

```
app/                  # Pages and API routes (Next.js App Router)
  api/                # Backend API endpoints
  processes/          # Process pages
  ...
components/           # Reusable UI components
  ui/                 # Base components (Card, Button, Badge, etc.)
lib/                  # Shared utilities, types, helpers
public/               # Static files (logo, icons, manifest)
supabase/             # Database migrations and seed scripts
docs/                 # Design docs and plans
```

## Getting Help

- Ask Jon
- Ask Claude Code — it reads `CLAUDE.md` and knows the full project context
- Check the `/help` page in the app
