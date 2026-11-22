# Party Game Companion — setup

Built against the Birthday Party Game Companion spec (MVP, §21).

## Two ways to run it

### 1. As-is (zero setup)
Open the link. Works immediately.
**Limit:** anyone who opens the join link must be signed in to a Claude
account. Fine for testing; not great for a real party.

### 2. Open join — anyone, no accounts (what §6.2 actually asks for)
Needs a free Firebase project. About 10 minutes, one time.

1. Go to <https://console.firebase.google.com> and click **Add project**.
   Name it anything. Turn Google Analytics **off**.
2. In the left sidebar pick **Build → Realtime Database → Create Database**.
   Choose a location, then start in **test mode**.
3. Still in Realtime Database, open the **Rules** tab and paste this,
   then click Publish:

   ```json
   {
     "rules": {
       "parties": {
         "$code": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```

   > These rules are wide open — fine for a party night, not for anything
   > with real data in it. Anyone who guesses a 5-letter code can read or
   > overwrite that party. Delete the project when the party's over.

4. Go to **Project settings** (gear icon) → scroll to **Your apps** →
   click the **web** icon `</>` → register the app. Firebase shows you a
   `firebaseConfig` block.
5. Open `config.js` in this project and paste the values in, and
   uncomment the `backend` line:

   ```js
   window.PD_CONFIG = {
     backend: "firebase",
     firebase: {
       apiKey:      "AIza...",
       authDomain:  "your-project.firebaseapp.com",
       databaseURL: "https://your-project-default-rtdb.firebaseio.com",
       projectId:   "your-project"
     }
   };
   ```

   `databaseURL` is the one that matters most — if it's missing, the app
   silently falls back to Claude sync.

**Heads up:** the Firebase SDK loads from Google's CDN at runtime. The
Claude artifact sandbox may block that. If the status bar still says
"joiners need a Claude account" after you've filled in the config, host
the files somewhere that allows it — Netlify Drop, Vercel, or GitHub
Pages are all free and take a couple of minutes. Drag this whole folder
onto <https://app.netlify.com/drop> and you get a public URL.

## Files

| File | What's in it |
|---|---|
| `index.html` | Shell, loads everything else |
| `config.js`  | **The only file you edit.** Sync backend choice |
| `model.js`   | Party state, rotation engine, scoring, ranking |
| `sync.js`    | Swappable sync layer (Firebase / Claude / offline) |
| `views.js`   | Host + participant screens |
| `app.js`     | Routing, events, wheel animation, persistence |
| `app.css`    | Styling |

## How the rotation works (spec §10)

Set spins per wheel and total rounds. The app builds the sequence itself:

- Multiplayer 2, 1v1 1, 5 rounds → `M M 1 · M M 1 · …` = 10 + 5 = **15 games**

Switching wheels, counting rounds, and detecting completion are all
automatic. The host can't spin while a game is still open, so nothing
gets double-counted.

## What's built vs. what isn't

**Built:** party creation, join codes, host lobby, pending admission +
approve/decline, quick-assign, late joining, live participant/connection
counts, teams with colours, both wheels with per-game enable toggles,
configurable rotation + rounds, animated wheel, game statuses
(selected / playing / completed / skipped), game history, individual +
team scoring with an undoable score log, personal rank with ties,
participant dashboard, leaderboards, party summary, refresh-safe
persistence, reconnection.

**Not built:** QR codes, drag-and-drop team assignment (tap-to-assign
instead), sound effects, theme switching, per-game time limits and
instructions, saving a summary to a file.
