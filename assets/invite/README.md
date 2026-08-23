# Invite assets

## `whatsapp-card.jpg` — the picture that goes with the WhatsApp invitation

**Not in the repository yet. Add it here and the admin page picks it up
with no code change.**

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

**Shape.** Portrait, 1080 × 1350, or square at 1080 × 1080. WhatsApp
crops a preview to roughly 4:5, so anything the eye must catch —
the name, the two covers — stays inside the middle four-fifths.

**Weight.** Under 5 MB, and JPEG rather than PNG: WhatsApp re-compresses
every image it sends, so a large PNG buys nothing and costs the sender's
data.

**Legibility.** Every word on it has to survive that re-compression at
about 400px wide on a phone. Test it by sending it to yourself before
sending it to anybody else.

If the file is absent the admin page says so plainly, disables
`Send with the card`, and the message-only path keeps working.

## `falling-star.png`, `little-seed.png`

The real Ether covers, extracted from the Canon thumbnails, used in the
email letter (`supabase/functions/invite-send`). They are the actual
covers a child meets in the Ether, not substitutes drawn for the email —
a book in the invitation has to be the book behind the door.
