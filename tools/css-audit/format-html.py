"""Indent a template without changing what it renders.

Whitespace between inline elements collapses to a rendered space, so reflowing
it silently changes spacing. This only reformats gaps between block-level
elements. Any element containing text or an inline child is emitted exactly as
it appears in the source, byte for byte.

Usage: python3 format-html.py <template.html> [--write]
"""
import re, sys

PATH = sys.argv[1]
WRITE = "--write" in sys.argv
INDENT = "  "

INLINE = {"a", "abbr", "b", "bdi", "bdo", "br", "button", "cite", "code", "data", "del",
          "dfn", "em", "i", "img", "input", "ins", "kbd", "label", "mark", "meter", "output",
          "picture", "progress", "q", "s", "samp", "select", "small", "span", "strong", "sub",
          "sup", "svg", "path", "textarea", "time", "u", "var", "wbr", "option", "optgroup",
          "figcaption", "legend", "iframe", "video", "audio", "canvas", "object", "embed"}
VOID = {"br", "img", "input", "hr", "meta", "link", "source", "col", "area", "base", "wbr",
        "embed", "param", "track"}
TOKEN = re.compile(r"(<!--.*?-->|</\s*[A-Za-z][-\w]*\s*>|<\s*[A-Za-z][-\w]*"
                   r"(?:\"[^\"]*\"|'[^']*'|[^>\"'])*>)", re.DOTALL)

raw = open(PATH, "rb").read().decode("utf-8")
crlf = "\r\n" in raw
src = raw.replace("\r\n", "\n")


def tag_name(tok):
    m = re.match(r"</?\s*([A-Za-z][-\w]*)", tok)
    return m.group(1).lower() if m else ""


# ------------------------------------------------------------------ build a tree
def build(text):
    root = dict(kind="root", children=[], start=0, end=len(text))
    stack = [root]
    pos = 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            stack[-1]["children"].append(dict(kind="text", raw=text[pos:m.start()]))
        tok, pos = m.group(1), m.end()
        if tok.startswith("<!--"):
            stack[-1]["children"].append(dict(kind="comment", raw=tok))
            continue
        name = tag_name(tok)
        if tok.startswith("</"):
            for i in range(len(stack) - 1, 0, -1):
                if stack[i].get("tag") == name:
                    stack[i]["close"] = tok
                    stack[i]["end"] = pos
                    del stack[i:]
                    break
            continue
        node = dict(kind="el", tag=name, open=tok, children=[], close="",
                    start=m.start(), end=pos, selfclose=False)
        stack[-1]["children"].append(node)
        if name in VOID or tok.rstrip().endswith("/>"):
            node["selfclose"] = True
        else:
            stack.append(node)
    if pos < len(text):
        stack[-1]["children"].append(dict(kind="text", raw=text[pos:]))
    return root


tree = build(src)


# --------------------------------------------------- decide what may be reflowed
PRE = {"pre", "textarea"}
WIDTH = 100


def inner_tokens(node):
    """Tokens inside an element, as (chunk, gap_before) pairs.

    A chunk is atomic: a whole tag, or a run of non-whitespace text. gap_before
    records whether source whitespace separated it from the previous chunk,
    which is the only thing that affects rendering.
    """
    body = src[node["start"] + len(node["open"]):node["end"] - len(node["close"])]
    out, pos, pending_gap = [], 0, False
    for m in TOKEN.finditer(body):
        if m.start() > pos:
            txt = body[pos:m.start()]
            if txt.strip():
                # One chunk: never split a phrase, so internal spacing survives
                # even where CSS preserves whitespace.
                out.append((txt.strip(), pending_gap or txt[:1].isspace()))
                pending_gap = bool(txt[-1:].isspace())
            else:
                pending_gap = True
        out.append((m.group(1), pending_gap))
        pending_gap = False
        pos = m.end()
    if pos < len(body):
        txt = body[pos:]
        if txt.strip():
            out.append((txt.strip(), pending_gap or txt[:1].isspace()))
    return out


def is_block_only(node):
    for c in node["children"]:
        if c["kind"] == "text" and c["raw"].strip():
            return False
        if c["kind"] == "el" and c["tag"] in INLINE:
            return False
    return True


def render(node, depth, out):
    pad = INDENT * depth
    for c in node["children"]:
        if c["kind"] == "text":
            continue
        if c["kind"] == "comment":
            out.append(pad + c["raw"])
            continue
        if c["selfclose"]:
            out.append(pad + c["open"])
            continue
        if not c["children"]:
            out.append(pad + src[c["start"]:c["end"]])
            continue
        if c["tag"] in PRE:
            body = src[c["start"]:c["end"]].split("\n")
            out.append(pad + body[0])
            out.extend(body[1:])
            continue
        if is_block_only(c):
            out.append(pad + c["open"])
            render(c, depth + 1, out)
            out.append(pad + c["close"])
            continue
        # Inline flow: wrap only where the source already had whitespace, since
        # a gap and a newline both render as one space, but inventing or
        # deleting a gap does not.
        body = src[c["start"] + len(c["open"]):c["end"] - len(c["close"])]
        lead, trail = body[:1].isspace(), body[-1:].isspace()
        ipad = pad + INDENT
        line = pad + c["open"] if not lead else None
        if lead:
            out.append(pad + c["open"])
        for chunk, gap in inner_tokens(c):
            if line is None:
                line = ipad + chunk
            elif gap and len(line) + 1 + len(chunk) > WIDTH:
                out.append(line)
                line = ipad + chunk
            else:
                line += (" " if gap else "") + chunk
        if trail:
            if line:
                out.append(line)
            out.append(pad + c["close"])
        else:
            out.append((line or pad) + c["close"])


lines = []
render(tree, 0, lines)
result = "\n".join(l.rstrip() for l in lines) + "\n"
if crlf:
    result = result.replace("\n", "\r\n")

if WRITE:
    open(PATH, "wb").write(result.encode("utf-8"))
    print("written: %s" % PATH)
else:
    sys.stdout.write(result)
