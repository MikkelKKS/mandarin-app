---
description: List the ideas in IDEAS.md waiting for a decision, so Mikkel can approve or reject them in the chat
model: haiku
---

Show Mikkel the ideas that are waiting for his decision, in the chat. Never open IDEAS.md in an editor.

1. `git pull --rebase`. If it conflicts, stop and explain simply.
2. Read the Ideas table in `IDEAS.md` and list every row whose status is `proposed` or `bug`, as a short numbered list (the number is the table's ID):
   `<ID>. <Title> (<type>, <size>): <why>`
   If there are none, say so in one line and stop.
3. End with one line: "Reply e.g. `approve 1 3, reject 2` (or `approve all`)."
4. When he replies, change those rows' Status to `approved` or `rejected` (only the Status column; leave rows he didn't mention alone). A `bug` row he approves becomes `approved`. Then commit (`Ideas: approved X, rejected Y`) and push to main, and tell him in one line what changed and that `/build` will build the approved ones.
