# The Haunted House Builder

A small static demo that lets you build a haunted house using HTML5 Drag & Drop.

Features included in this scaffold:

- Drag-and-drop room templates onto a 4x4 canvas.
- Drag furniture into rooms (ghosts, candles, skulls).
- A "Haunt-o-meter" that updates live based on room + furniture haunt values.
- Save / Load layout via localStorage.
 - Drag-and-drop assets (ghost, candle, bug) onto the house SVG.
 - Placed assets update the Haunt-o-meter. Right-click a placed item to remove it.
 - Save / Load layout via localStorage.

How to run

1. Open `index.html` in your browser (double-click or serve with a static server).
2. Drag spooky objects from the left into the house image. Place them where you like.
3. Right-click a placed asset to remove it.
4. Click "Save Layout" to persist locally, or "Load Layout" to restore.

Notes & next steps

- This is a simple client-side demo. If you want persistent storage across devices, add a backend API.
- Improvements: nicer graphics, snapping/resize rooms, grid resizing, undo/redo, unit tests.

Enjoy building spooky houses!
