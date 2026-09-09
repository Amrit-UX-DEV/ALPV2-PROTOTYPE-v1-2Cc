"""Prove a reformatted template renders identically to the original.

Checks three things:
  1. the tag and attribute stream is byte-identical in order
  2. every text node with content is byte-identical
  3. whitespace-only gaps changed only where both neighbours are block-level,
     since whitespace between inline elements renders as a space and whitespace
     between block elements does not

Usage: python3 verify-format.py <before.html> <after.html>
"""
import re, sys

BEFORE, AFTER = sys.argv[1], sys.argv[2]
INLINE = {"a", "abbr", "b", "bdi", "bdo", "br", "button", "cite", "code", "data", "del",
          "dfn", "em", "i", "img", "input", "ins", "kbd", "label", "mark", "meter", "output",
          "picture", "progress", "q", "s", "samp", "select", "small", "span", "strong", "sub",
          "sup", "svg", "path", "textarea", "time", "u", "var", "wbr", "option", "optgroup",
          "figcaption", "legend", "iframe", "video", "audio", "canvas", "object", "embed"}
TOKEN = re.compile(r"(<!--.*?-->|</\s*[A-Za-z][-\w]*\s*>|<\s*[A-Za-z][-\w]*"
                   r"(?:\"[^\"]*\"|'[^']*'|[^>\"'])*>)", re.DOTALL)


def tokens(path):
    text = open(path, "rb").read().decode("utf-8").replace("\r\n", "\n")
    out, pos = [], 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            out.append(("text", text[pos:m.start()]))
        tok, pos = m.group(1), m.end()
        out.append(("comment" if tok.startswith("<!--") else "tag", tok))
    if pos < len(text):
        out.append(("text", text[pos:]))
    return out


def name(tok):
    m = re.match(r"</?\s*([A-Za-z][-\w]*)", tok)
    return m.group(1).lower() if m else ""


a, b = tokens(BEFORE), tokens(AFTER)
fails = []

# 1 and 2: everything that is not a whitespace-only gap must be identical
sig = lambda ts: [(k, v) for k, v in ts if not (k == "text" and not v.strip())]
sa, sb = sig(a), sig(b)
print("significant tokens : %d -> %d" % (len(sa), len(sb)))
if len(sa) != len(sb):
    fails.append("token count changed")
else:
    for i, (x, y) in enumerate(zip(sa, sb)):
        if x[0] != y[0] or x[1].strip() != y[1].strip():
            fails.append("token %d differs:\n      %r\n      %r" % (i, x[1][:90], y[1][:90]))
            if len([f for f in fails if "differs" in f]) > 4:
                break
        elif x[0] == "text" and (
                (x[1][:1].isspace(), x[1][-1:].isspace(), x[1].strip())
                != (y[1][:1].isspace(), y[1][-1:].isspace(), y[1].strip())):
            fails.append("text node %d had its surrounding whitespace changed: %r -> %r"
                         % (i, x[1][:60], y[1][:60]))

# 3: whitespace gaps may only change between block-level neighbours
def gaps(ts):
    out = []
    for i, (k, v) in enumerate(ts):
        if k != "text" or v.strip():
            continue
        prev = next((t for t in reversed(ts[:i]) if t[0] != "text" or t[1].strip()), None)
        nxt = next((t for t in ts[i + 1:] if t[0] != "text" or t[1].strip()), None)
        out.append((v, prev[1] if prev else "", nxt[1] if nxt else ""))
    return out


ga, gb = gaps(a), gaps(b)
lookup = {}
for v, p, n in ga:
    lookup.setdefault((p, n), []).append(v)
# A run of whitespace collapses to one rendered space, so what matters is
# whether a gap exists, not how it is spelt. Adding a gap where there was none
# inserts a space; removing one deletes a space. Both are real. Respacing is not.
collapse = lambda w: " " if w else ""

changed = risky = 0
for v, p, n in gb:
    same = lookup.get((p, n))
    if same and any(collapse(x) == collapse(v) for x in same):
        same.remove(next(x for x in same if collapse(x) == collapse(v)))
        continue
    changed += 1
    pn, nn = name(p), name(n)
    inline_side = (pn in INLINE and not p.startswith("</")) or (nn in INLINE and not n.startswith("</")) \
        or (p.startswith("</") and pn in INLINE) or (n.startswith("</") and nn in INLINE)
    if inline_side:
        risky += 1
        if risky <= 5:
            fails.append("whitespace changed next to an inline element: %s | %r | %s"
                         % (p[:40], v[:20], n[:40]))
# The reverse direction matters just as much: deleting a gap deletes a rendered
# space. Whitespace at the very start or end of a template is exempt, since it
# has no sibling to separate it from.
reverse = {}
for v, p, n in gb:
    reverse.setdefault((p, n), []).append(v)
lost = lost_risky = 0
for v, p, n in ga:
    same = reverse.get((p, n))
    if same and any(collapse(x) == collapse(v) for x in same):
        same.remove(next(x for x in same if collapse(x) == collapse(v)))
        continue
    if not p or not n:
        continue
    lost += 1
    pn, nn = name(p), name(n)
    if pn in INLINE or nn in INLINE:
        lost_risky += 1
        if lost_risky <= 5:
            fails.append("whitespace REMOVED next to an inline element: %s | %r | %s"
                         % (p[:40], v[:20], n[:40]))
print("whitespace gaps    : %d -> %d  (%d added or respaced, %d removed; %d next to inline)"
      % (len(ga), len(gb), changed, lost, risky + lost_risky))

if fails:
    print("\nFAILURES")
    for f in fails[:12]:
        print("  - %s" % f)
    sys.exit(1)
print("\nIDENTICAL RENDER: tags, attributes and text unchanged; whitespace only moved between block elements")
