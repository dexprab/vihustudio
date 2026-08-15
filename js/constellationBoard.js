// constellationBoard.js — the sky a Creator draws their constellation on.
//
// A 10×10 field of stars. Tap them in order; a coloured line follows
// the hand; tap one again to take it back. That is the whole
// component, and it knows nothing else: not what a Magic Card is, not
// what a pattern means, not whether the sky it just drew belongs to
// anybody. It hands back coordinates. Whoever asked decides what they
// are worth.
//
// ---------------------------------------------------------------
// WHY A COMPONENT AND NOT A THIRD COPY
//
// This grid already exists twice: js/creationFlow.js built it for
// unlocking a World, and js/magicCardUI.js rebuilt it for the Creator
// gate — the second one says so in its own comment, because the first
// one's helpers are module-private and could not be reached from
// outside. Both are inside frozen Studio subsystems and are staying
// exactly as they are.
//
// VihuPlanet needed the same grid on a page that loads neither of
// them, so rather than write it a third time and leave the next
// surface to write a fourth, it is a component. Nothing in it is
// VihuPlanet-specific; the two Studio copies could adopt it whenever
// somebody is changing that code for another reason. Nobody should
// change them just for this.
// ---------------------------------------------------------------
//
// Two details carried over deliberately, because both were real fixes
// rather than decoration:
//
//   · EVERY cell shows the same dim star at rest. Reported during the
//     Magic Card work as "very difficult to show the stars" — a child
//     on a touch device has no hover, so a board that only lights a
//     sparse subset gives no clue where the other tappable positions
//     are. Uniform is also better camouflage, not worse: with every
//     cell identical there is no visible subset for a shoulder-surfer
//     to tell a real tap from.
//   · The board carried no row or column numbers, on the reasoning
//     that a hidden coordinate system tells a passer-by nothing about
//     what the board holds. Sky Protection changed the facts under
//     that: the recovery email a parent receives names every star as
//     "row 3, column 5", and a board with no numbers left them
//     counting squares with a finger. An unreadable recovery route is
//     not a recovery route. `labels: true` turns them on.
//
//     The privacy cost is close to nothing, which is why this is a
//     straight improvement rather than a trade: the numbers name
//     positions, they do not reveal which positions are lit, and every
//     cell still carries the same dim star at rest.

const ConstellationBoard = (function () {
  'use strict';

  var SIZE = 10;

  // Each star takes its own colour, in tap order. Recomputed from the
  // selection on every change rather than stamped on a cell, so undoing
  // one in the middle re-colours everything after it instead of leaving
  // a gap in the sequence.
  var PALETTE = ['#FFCB45', '#B388FF', '#5CE1E6', '#FF6FA5',
                 '#5CFFB0', '#FF8B5C', '#7C9CFF', '#FFD166'];

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function key(r, c) { return r + ',' + c; }

  function centreOf(board, r, c) {
    var el = board.querySelector('[data-row="' + r + '"][data-col="' + c + '"]');
    if (!el) return { x: 0, y: 0 };
    return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
  }

  function create(opts) {
    opts = opts || {};
    var mount = opts.mount;
    if (!mount) return null;
    var size = opts.size || SIZE;
    var labels = opts.labels === true;
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    var board = document.createElement('div');
    board.className = 'vp-stars-board' + (labels ? ' has-labels' : '');
    board.style.setProperty('--vp-stars-size', String(size));
    mount.appendChild(board);

    // With labels the grid gains one track on each side for them, so
    // every star sits one row and one column further in.
    var off = labels ? 1 : 0;

    var selected = [];
    var cells = [];

    if (labels) makeLabels();

    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        cells.push(makeCell(r, c));
      }
    }

    // Numbered from 1, because the recovery email is read by a parent
    // counting on a screen, not by a programmer. aria-hidden: a screen
    // reader already hears "Star, row 3, column 5" from the star
    // itself, and a lone "3" floating beside it would only add noise.
    function makeLabels() {
      var i, el;
      for (i = 0; i < size; i++) {
        el = document.createElement('span');
        el.className = 'vp-stars-label is-col';
        el.textContent = String(i + 1);
        el.setAttribute('aria-hidden', 'true');
        el.style.gridRow = '1';
        el.style.gridColumn = String(i + 2);
        board.appendChild(el);

        el = document.createElement('span');
        el.className = 'vp-stars-label is-row';
        el.textContent = String(i + 1);
        el.setAttribute('aria-hidden', 'true');
        el.style.gridRow = String(i + 2);
        el.style.gridColumn = '1';
        board.appendChild(el);
      }
    }

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'vp-stars-lines');
    svg.setAttribute('aria-hidden', 'true');
    board.appendChild(svg);

    function makeCell(row, col) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'vp-stars-cell';
      cell.textContent = '★';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.style.gridRow = String(row + 1 + off);
      cell.style.gridColumn = String(col + 1 + off);
      // Out of step with each other, so the board twinkles like a sky
      // instead of pulsing like one light. Harmless under reduced
      // motion, where the CSS turns the animation off outright.
      cell.style.animationDelay = (Math.random() * 2.4).toFixed(2) + 's';
      cell.style.animationDuration = (1.8 + Math.random() * 1.6).toFixed(2) + 's';
      // A screen reader needs SOME way to tell one star from another,
      // and position is the only thing that distinguishes them. It is
      // spoken, never drawn.
      cell.setAttribute('aria-label', 'Star, row ' + (row + 1) + ', column ' + (col + 1));
      cell.addEventListener('click', function () {
        // The child has touched it, so the order is theirs now and the
        // line is no longer a guess about anybody's card.
        quiet = false;
        toggle(row, col, cell);
      });
      board.appendChild(cell);
      return cell;
    }

    function toggle(row, col, cell) {
      var k = key(row, col);
      var at = selected.indexOf(k);
      if (at === -1) {
        selected.push(k);
        cell.classList.add('is-lit');
        cell.setAttribute('aria-pressed', 'true');
      } else {
        selected.splice(at, 1);
        cell.classList.remove('is-lit');
        cell.removeAttribute('aria-pressed');
        cell.style.removeProperty('--vp-star-color');
      }
      paint();
      onChange(selected.length);
    }

    var quiet = false;

    function paint() {
      var i, parts, cell;
      for (i = 0; i < selected.length; i++) {
        parts = selected[i].split(',');
        cell = board.querySelector('[data-row="' + parts[0] + '"][data-col="' + parts[1] + '"]');
        if (cell) cell.style.setProperty('--vp-star-color', PALETTE[i % PALETTE.length]);
      }

      svg.innerHTML = '';
      if (selected.length < 2) return;
      // A LINE ASSERTS AN ORDER, AND SOMETIMES THERE ISN'T ONE TO KNOW.
      //
      // A sky marked from a photograph has stars but no tap order: the
      // camera found them in whatever order it found them. For most
      // constellations the true order can be recovered from the cells,
      // but a symmetric one — CYGNUS is a perfect cross — maps onto its
      // own five cells under all four rotations and both mirrors, so
      // the ONLY thing telling those apart is the very order that was
      // not observed. Drawing one anyway produced a card traced upside
      // down, reported as exactly that.
      //
      // So the caller can ask for the stars without the line. Nothing
      // is hidden: every star the camera saw is lit and can be checked
      // against the card. What is not drawn is the one thing that would
      // be a guess. The first tap clears the flag, because from then on
      // the order is the child's own and is not in doubt.
      if (quiet) return;
      var pts = selected.map(function (k) {
        var p = k.split(',');
        return centreOf(board, parseInt(p[0], 10), parseInt(p[1], 10));
      });
      for (i = 0; i < pts.length - 1; i++) {
        var line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', pts[i].x);
        line.setAttribute('y1', pts[i].y);
        line.setAttribute('x2', pts[i + 1].x);
        line.setAttribute('y2', pts[i + 1].y);
        line.setAttribute('class', 'vp-stars-line');
        // A segment takes the colour of the star it arrives at, so the
        // trail reads as one drawn line changing colour rather than as
        // a set of separate gold sticks.
        var colour = PALETTE[(i + 1) % PALETTE.length];
        line.style.stroke = colour;
        line.style.filter = 'drop-shadow(0 0 4px ' + colour + ')';
        svg.appendChild(line);
      }
    }

    // Deliberately SILENT. onChange means "the child changed the sky",
    // and every caller of clear() is the page resetting the board for
    // its own reasons — after a sky was not recognised, on reopening,
    // on Try Again. Firing it here made clear() wipe whatever had just
    // been said about the very sky it was clearing: the page set the
    // line, called clear(), and clear() called back to erase it. The
    // gentle message after several tries never survived long enough to
    // be read.
    function clear() {
      for (var i = 0; i < cells.length; i++) {
        cells[i].classList.remove('is-lit');
        cells[i].removeAttribute('aria-pressed');
        cells[i].style.removeProperty('--vp-star-color');
      }
      selected.length = 0;
      svg.innerHTML = '';
    }

    return {
      el: board,
      count: function () { return selected.length; },
      // [[row, col], …] in the order they were tapped.
      pattern: function () {
        return selected.map(function (k) {
          var p = k.split(',');
          return [parseInt(p[0], 10), parseInt(p[1], 10)];
        });
      },
      clear: clear,
      // Move the whole sky by a row or a column.
      //
      // The camera reads a card's SHAPE reliably and its POSITION only
      // approximately — measured, every star comes out right and the
      // whole constellation sits a row or two from where it belongs.
      // Correcting that star by star is seven taps for a wrong answer;
      // moving it as one thing is the correction the mistake actually
      // calls for.
      //
      // Refuses rather than clips when the sky would leave the grid, so
      // a nudge can never quietly change the shape.
      nudge: function (dr, dc) {
        var pts = selected.map(function (k) {
          var q = k.split(',');
          return [parseInt(q[0], 10) + dr, parseInt(q[1], 10) + dc];
        });
        if (!pts.length) return false;
        for (var i = 0; i < pts.length; i++) {
          if (pts[i][0] < 0 || pts[i][0] >= size || pts[i][1] < 0 || pts[i][1] >= size) return false;
        }
        clear();
        pts.forEach(function (p) {
          var cell = board.querySelector('[data-row="' + p[0] + '"][data-col="' + p[1] + '"]');
          if (cell) toggle(p[0], p[1], cell);
        });
        return true;
      },
      // Light these cells, as though they had been tapped.
      //
      // The camera reads a child's card and marks the board with what
      // it saw, so the child confirms or nudges rather than drawing
      // from scratch. Deliberately goes through the same toggle() every
      // tap uses, so a marked-by-camera sky and a drawn one are the
      // same thing in every respect that follows.
      set: function (pattern, opts) {
        clear();
        // `quiet` suppresses the joining line only — see paint().
        quiet = !!(opts && opts.noLine);
        (pattern || []).forEach(function (p) {
          var cell = board.querySelector('[data-row="' + p[0] + '"][data-col="' + p[1] + '"]');
          if (cell) toggle(p[0], p[1], cell);
        });
      },
      // The lines are drawn from measured pixel positions, so they are
      // wrong the moment the board changes size and right again the
      // moment this is called.
      reflow: paint,
      destroy: function () {
        if (board.parentNode) board.parentNode.removeChild(board);
        cells.length = 0;
        selected.length = 0;
      }
    };
  }

  var api = { create: create, SIZE: SIZE };
  try { window.ConstellationBoard = api; } catch (e) {}
  return api;
})();
