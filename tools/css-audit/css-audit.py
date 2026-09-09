"""Audit what would happen if an inline style were replaced by a class.

An inline style beats every selector, so moving it into a class can hand
victory to a global rule that previously lost. For each styled element in a
template this finds the rules that really could match it, taking ancestors and
combinators into account, and reports which would now win.

Rules are grouped by confidence:
  MATCHES   every compound satisfied within this template
  EXTERNAL  needs ancestors this template does not contain, so it depends on
            where the component is mounted
  STATEFUL  only applies in a state such as :hover or :checked

Usage: python3 css-audit.py <template.html>
"""
import json, os, re, sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.abspath(__file__))
TPL = sys.argv[1]
UTIL_SPEC = (0, 1, 0)  # an alp- utility is a single class
VOID = {"br", "img", "input", "hr", "meta", "link", "source", "col", "area"}
STATE_PC = re.compile(r":(hover|focus|active|checked|disabled|target|visited|focus-within|"
                      r"focus-visible|first-child|last-child|nth-child|nth-of-type|empty|before|after)")


# ---------------------------------------------------------------- load the CSS
def entry_points():
    out = []
    ng = json.load(open(os.path.join(ROOT, "angular.json")))
    for _, proj in ng.get("projects", {}).items():
        for s in proj.get("architect", {}).get("build", {}).get("options", {}).get("styles", []):
            out.append(s if isinstance(s, str) else s.get("input"))
    idx = os.path.join(ROOT, "src/index.html")
    if os.path.exists(idx):
        for href in re.findall(r'<link[^>]+href="([^"]+)"', open(idx, encoding="utf-8").read()):
            if href.endswith(".css") and not href.startswith(("http", "//")):
                out.append("src/" + href.lstrip("./"))
    return [p for p in out if p]


def resolve(path, seen):
    path = os.path.normpath(path)
    if path in seen or not os.path.exists(path):
        return []
    seen.add(path)
    text = open(path, encoding="utf-8", errors="replace").read()
    files = []
    for imp in re.findall(r"@import\s+(?:url\()?['\"]([^'\"]+)['\"]", text):
        files += resolve(os.path.join(os.path.dirname(path), imp), seen)
    return files + [(path, text)]


sheets, seen = [], set()
for e in entry_points():
    sheets += resolve(os.path.join(ROOT, e), seen)

COMMENT = re.compile(r"/\*.*?\*/", re.S)
RULE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)


def specificity(sel):
    s = re.sub(r"::?[\w-]+(\([^)]*\))?", " PC ", sel)
    return (len(re.findall(r"#[\w-]+", s)),
            len(re.findall(r"\.[\w-]+", s)) + len(re.findall(r"\[[^]]+\]", s)) + s.count("PC"),
            len(re.findall(r"(?:^|[\s>+~])([a-zA-Z][\w-]*)", s)))


rules, order = [], 0
for path, text in sheets:
    body = re.sub(r"@media[^{]*\{", "", COMMENT.sub("", text))
    for m in RULE.finditer(body):
        sels, decls = m.group(1), m.group(2)
        if sels.strip().startswith("@"):
            continue
        parsed = []
        for d in decls.split(";"):
            if ":" not in d:
                continue
            prop, _, val = d.partition(":")
            if prop.strip() and val.strip():
                parsed.append((prop.strip().lower(), val.strip()))
        for sel in (s for s in sels.split(",") if s.strip()):
            sel = " ".join(sel.split())
            for prop, val in parsed:
                rules.append(dict(order=order, file=os.path.relpath(path, ROOT), sel=sel, prop=prop,
                                  val=val.replace("!important", "").strip(),
                                  imp="!important" in val, spec=specificity(sel)))
            order += 1


# ------------------------------------------------- parse the template to a tree
TAG = re.compile(r"<!--.*?-->|</\s*([A-Za-z][-\w]*)\s*>|<\s*([A-Za-z][-\w]*)"
                 r"((?:\"[^\"]*\"|'[^']*'|[^>\"'])*)>", re.DOTALL)
raw = open(os.path.join(ROOT, TPL), encoding="utf-8").read()


ATTR_ANY = re.compile(r'([-\w:.\[\]()@*#]+)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+))?')


def attrs_of(s):
    """Attributes of a tag, including valueless ones such as the bare attribute
    an Angular attribute selector uses for its host."""
    out = {}
    for k, v in ATTR_ANY.findall(s):
        out[k.lower()] = (v or "").strip("\"'")
    return out


def parse(text):
    """Return (elements, index) for a template, each element carrying ancestors."""
    els, stk = [], []
    for mm in TAG.finditer(text):
        if mm.group(0).startswith("<!--"):
            continue
        if mm.group(1):
            if stk and stk[-1]["tag"] == mm.group(1).lower():
                stk.pop()
            continue
        t, aa = mm.group(2).lower(), mm.group(3)
        a = attrs_of(aa)
        n = dict(tag=t, attrs=a, cls=set(a.get("class", "").split()), id=a.get("id"),
                 line=text.count("\n", 0, mm.start()) + 1, ancestors=list(stk), style=a.get("style"))
        els.append(n)
        if t not in VOID and not aa.rstrip().endswith("/"):
            stk.append(n)
    return els


def component_map():
    """selector -> template path, and template path -> selector."""
    sel2tpl, tpl2sel = {}, {}
    for base, _, files in os.walk(os.path.join(ROOT, "src/app")):
        for f in files:
            if not f.endswith(".ts"):
                continue
            src = open(os.path.join(base, f), encoding="utf-8", errors="replace").read()
            sel = re.search(r"selector:\s*'([^']+)'", src)
            tpl = re.search(r"templateUrl:\s*'([^']+)'", src)
            if sel and tpl:
                path = os.path.normpath(os.path.join(base, tpl.group(1)))
                sel2tpl[sel.group(1)] = path
                tpl2sel[path] = sel.group(1)
    return sel2tpl, tpl2sel


def selector_predicate(sel):
    """A component selector may be an element or an attribute, such as
    div[alpha-explorer-toolbar], which keeps the host as an existing element."""
    m = re.match(r"^([a-zA-Z][\w-]*)?(?:\[([-\w]+)\])?$", sel.strip())
    if not m or not (m.group(1) or m.group(2)):
        return None
    tag, attr = m.group(1), m.group(2)
    return lambda n: ((tag is None or n["tag"] == tag.lower())
                      and (attr is None or attr.lower() in n["attrs"]))


def host_chain(tpl_path, sel2tpl, tpl2sel, depth=0):
    """Ancestors of this component's host element, walking up through parents."""
    if depth > 6:
        return []
    sel = tpl2sel.get(os.path.normpath(tpl_path))
    pred = selector_predicate(sel) if sel else None
    if not pred:
        return []
    for parent_tpl in tpl2sel:
        if parent_tpl == os.path.normpath(tpl_path) or not os.path.exists(parent_tpl):
            continue
        text = open(parent_tpl, encoding="utf-8", errors="replace").read()
        for n in parse(text):
            if pred(n):
                return host_chain(parent_tpl, sel2tpl, tpl2sel, depth + 1) + n["ancestors"] + [n]
    return []


SEL2TPL, TPL2SEL = component_map()
CHAIN = host_chain(os.path.join(ROOT, TPL), SEL2TPL, TPL2SEL)
print("host chain: %s\n" % (" > ".join("%s%s" % (n["tag"], "." + ".".join(sorted(n["cls"])) if n["cls"] else "")
                                        for n in CHAIN) or "(root)"))

# The chain reaches the application root, so an ancestor we cannot find is a
# real non-match rather than an unknown. Classes that jQuery adds to ancestors
# at runtime are the exception, and sibling combinators are still not modelled.
CHAIN_COMPLETE = bool(CHAIN)

elements, stack = [], list(CHAIN)
for m in TAG.finditer(raw):
    if m.group(0).startswith("<!--"):
        continue
    if m.group(1):
        if stack and stack[-1]["tag"] == m.group(1).lower():
            stack.pop()
        continue
    tag, at = m.group(2).lower(), m.group(3)
    a = attrs_of(at)
    node = dict(tag=tag, attrs=a, cls=set(a.get("class", "").split()),
                id=a.get("id"), line=raw.count("\n", 0, m.start()) + 1,
                ancestors=list(stack), style=a.get("style"))
    elements.append(node)
    if tag not in VOID and not at.rstrip().endswith("/"):
        stack.append(node)


# ------------------------------------------------------------- selector matching
def compound_match(comp, node):
    if STATE_PC.search(comp):
        return None  # stateful, reported separately
    comp = re.sub(r"::?[\w-]+(\([^)]*\))?", "", comp)
    tag = re.match(r"^([a-zA-Z][\w-]*)", comp)
    if tag and tag.group(1).lower() not in (node["tag"], "*"):
        return False
    if not set(re.findall(r"\.([\w-]+)", comp)) <= node["cls"]:
        return False
    ids = re.findall(r"#([\w-]+)", comp)
    if ids and node["id"] not in ids:
        return False
    for a in re.findall(r"\[([^]]+)\]", comp):
        name = re.split(r"[~^|$*]?=", a)[0].strip()
        if name not in node["attrs"]:
            return False
    return True


def match(sel, node):
    """Right-to-left match. Returns 'match', 'external', 'stateful' or None."""
    # :host only matches a shadow host. Angular rewrites it inside component
    # stylesheets, but every sheet scanned here is global, where it is inert.
    if ":host" in sel:
        return None
    # A pseudo-element styles a generated box, not the element itself, so it
    # never competes with a declaration on the element.
    if "::" in sel or re.search(r"(?<!:):(before|after|placeholder|selection|"
                                r"first-line|first-letter|backdrop|marker)\b", sel):
        return None
    parts = re.split(r"\s*([>+~])\s*|\s+", sel.strip())
    parts = [p for p in parts if p]
    if not parts:
        return None
    stateful = bool(STATE_PC.search(sel))
    res = compound_match(parts[-1], node)
    if res is False:
        return None
    if res is None:
        return "stateful"
    i, anc = len(parts) - 2, list(node["ancestors"])
    while i >= 0:
        comb = parts[i] if parts[i] in ">+~" else " "
        if parts[i] in ">+~":
            i -= 1
            if i < 0:
                break
        want = parts[i]
        if comb == ">":
            if not anc:
                return None if CHAIN_COMPLETE else "external"
            parent = anc.pop()
            if compound_match(want, parent) is not True:
                return None
        elif comb in "+~":
            return "stateful" if stateful else "external"  # sibling: not modelled
        else:
            while anc:
                cand = anc.pop()
                if compound_match(want, cand) is True:
                    break
            else:
                return None if CHAIN_COMPLETE else "external"
        i -= 1
    return "stateful" if stateful else "match"


# --------------------------------------------------------------------- report
print("stylesheets: %d   rules: %d   template elements: %d\n" % (len(sheets), len(rules), len(elements)))
verdicts = []
for node in [e for e in elements if e["style"]]:
    print("L%-4s <%s class=\"%s\">" % (node["line"], node["tag"], " ".join(sorted(node["cls"]))[:64]))
    for d in node["style"].split(";"):
        if ":" not in d:
            continue
        prop, _, val = d.partition(":")
        prop, val = prop.strip().lower(), val.strip()
        if not prop:
            continue
        hits = {"match": [], "external": [], "stateful": []}
        for r in rules:
            if r["prop"] != prop:
                continue
            v = match(r["sel"], node)
            if v:
                hits[v].append(r)
        winners = [r for r in hits["match"] if r["imp"] or r["spec"] > UTIL_SPEC]
        winners.sort(key=lambda r: (r["imp"], r["spec"], r["order"]), reverse=True)
        verdict = "CONTESTED" if winners else ("check" if hits["external"] else "safe")
        verdicts.append((verdict, node["line"], prop))
        print("    %-15s %-26s %-9s match=%d external=%d stateful=%d"
              % (prop + ":", val[:26], verdict, len(hits["match"]), len(hits["external"]), len(hits["stateful"])))
        for r in winners[:3]:
            print("        BEATS IT  %s {%s: %s%s}  spec=%s  %s"
                  % (r["sel"][:52], r["prop"], r["val"][:18], " !important" if r["imp"] else "",
                     r["spec"], r["file"].split("/")[-1]))
        for r in sorted(hits["external"], key=lambda r: r["spec"], reverse=True)[:2]:
            print("        depends on mount point  %s  spec=%s  %s"
                  % (r["sel"][:52], r["spec"], r["file"].split("/")[-1]))
print("\n%d declarations: %d safe, %d need a look, %d contested"
      % (len(verdicts), sum(v[0] == "safe" for v in verdicts),
         sum(v[0] == "check" for v in verdicts), sum(v[0] == "CONTESTED" for v in verdicts)))
