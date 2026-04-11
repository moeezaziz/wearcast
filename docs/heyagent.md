# HeyAgent Phone Workflow

Use HeyAgent to send WearCast coding requests from Telegram on your iPhone to a local Codex session on this Mac.

## What Is Installed

HeyAgent is installed globally with npm:

```bash
npm install -g heyagent
```

The `hey` command is available at:

```bash
/opt/homebrew/bin/hey
```

HeyAgent stores its Telegram bot token and pairing data locally in:

```bash
~/.heyagent/config.json
```

Do not commit that file or paste the bot token into the repo.

## First-Time Pairing

1. Open Telegram on your iPhone.
2. Message `@BotFather`.
3. Send `/newbot`.
4. Follow BotFather's prompts and copy the bot token.
5. In this repo, run:

```bash
npm run phone:codex
```

6. Choose the guided phone setup or manual fallback.
7. Paste the Telegram bot token only into HeyAgent's setup prompt.
8. Open your new bot in Telegram and press `START`.
9. Run this to confirm pairing:

```bash
npm run phone:status
```

## Daily Use

Start or resume the phone bridge from the WearCast repo:

```bash
npm run phone:codex
```

Start a fresh Codex session:

```bash
npm run phone:codex:new
```

Reset Telegram pairing if you rotate the bot token:

```bash
npm run phone:reset
```

## Progress Updates

This machine's global HeyAgent install has been lightly patched to send activity-aware progress messages while Codex is running:

```text
Codex is working...
Codex: Updating the app interface
Codex: Syncing the iOS app shell
Codex: Building the iOS app
Codex: Starting the iOS simulator
Codex: Capturing simulator screenshots
Codex: Building the iOS app (1 min)...
Codex finished. Sending results...
```

Restart the bridge after changing this behavior:

```bash
npm run phone:codex
```

Note: reinstalling or upgrading `heyagent` can overwrite this local patch.

## Telegram Commands

Send these to your bot:

```text
/status
/new
/codex
/stop
/help
```

Any regular message is forwarded to Codex.

## Recommended Message Format

For coding tasks:

```text
In WearCast, fix the Today recommendation header spacing. Make the change, run syntax checks, and summarize files changed. Do not deploy.
```

For deploys:

```text
Deploy WearCast after verifying node syntax checks pass.
```

For iOS simulator screenshots:

```text
Sync iOS, build and launch the simulator, open Today, and send me a screenshot.
```

## Safety Notes

HeyAgent runs locally and forwards your Telegram messages to the Codex CLI in this project directory. Keep the terminal open while you want the bridge active.

Treat the Telegram bot as a remote-control channel for your machine. Only pair your own chat, do not share the bot token, and use `/stop` if a task is going the wrong direction.

Deploys, account/auth changes, database migrations, native iOS changes, and destructive commands should still be explicitly requested.
