# Invite assets

## `whatsapp-card.jpg` — the picture that goes with the WhatsApp invitation

Supplied by the product owner. **1080 × 1620, JPEG, 433 KB** — the
artwork's own 2:3, scaled rather than reframed.

The WhatsApp invitation is one image plus a caption. The words are the
caption — `waCaption()` in `admin/invites.html`, 700 characters of
Lumo's letter, well inside WhatsApp's 1024-character limit — so this
file is the **illustration only**, not the whole letter rendered as a
picture. Body text baked into an image is unreadable at phone width and
cannot be copied, translated or read aloud by a screen reader.

What belongs on it: the door, the lantern, the two books, Lumo, the
VihuPlanet name and its one line, `Open the Door`, and the short lines
that are already part of the artwork (`I left the door open for you`,
`No account. Nothing to pay. Just come in.`). The parents' band belongs
here too — it is the one piece of copy the caption deliberately drops.

**Shape.** Portrait. WhatsApp crops the chat-bubble preview to roughly
4:5 and shows the whole thing when it is tapped, so anything the eye
must catch has to survive a centre crop. Checked on the shipped card:
the 4:5 crop loses the star above the title and the closing line *Just
come in.*, and keeps the name, the tagline, the sign, both covers,
`Open the Door` and `No account. Nothing to pay.` A replacement should
be held to the same test — render a centre crop of it and look, rather
than trusting a ratio.

**Weight.** Under 5 MB, and JPEG rather than PNG: WhatsApp re-compresses
every image it sends, so a large PNG buys nothing and costs the sender's
data.

**Legibility.** Every word on it has to survive that re-compression at
about 400px wide on a phone. Test it by sending it to yourself before
sending it to anybody else.

If the file is absent the admin page says so plainly, disables
`Send with the card`, and the message-only path keeps working — so
replacing this file badly degrades to a working invitation rather than
a broken button.

## `falling-star.png`, `little-seed.png`

The real Ether covers, extracted from the Canon thumbnails, used in the
email letter (`supabase/functions/invite-send`). They are the actual
covers a child meets in the Ether, not substitutes drawn for the email —
a book in the invitation has to be the book behind the door.
