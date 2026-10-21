#!/usr/bin/env python3
"""build_playbook.py - RPE Unit 4 playbook: one arc-slides talk with the ace-live round woven in.

usage: python build_playbook.py --skills <kp-skills folder> -o <out dir> [--api URL] [--backend appsscript|firestore]

- arc-slides (build_talk.py) checks talk.json against every talk rule and writes the speaker script;
- ace-live (build_live.py) builds the deck shell (PIN gate, status dot, phone view, KP_LIVE from the in_lecture preset);
- the talk slides fill the deck in talk order, and each "live" check slide becomes the ace-live join, question or
  leaderboard slide, so slide numbers match the speaker script (#sN = #pN).
Nothing here edits kp-skills. The /exec URL is passed on the command line only and never written into this folder's sources.
"""
import argparse, json, pathlib, re, shutil, sys, tempfile, types

HERE = pathlib.Path(__file__).resolve().parent


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--skills", required=True); ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--api", default=""); ap.add_argument("--backend", default="appsscript")
    a = ap.parse_args(argv)
    S = pathlib.Path(a.skills).resolve()
    sys.path.insert(0, str(S / "arc-slides" / "scripts")); sys.path.insert(0, str(S / "ace-live" / "scripts"))
    import build_talk as BT, build_live as BL
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    talk_p = HERE / "talk.json"
    src = json.loads(talk_p.read_text(encoding="utf-8"))
    files, note = BT.build(str(talk_p), str(out), nav="kp")          # rules + speaker script (+ a talk-only deck, replaced below)
    print(note)
    bank = json.loads((HERE / "bank.json").read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in bank}
    asked = [s["live"] for s in src["slides"] if s.get("live") not in (None, "join", "board")]
    if asked != [q["id"] for q in bank]:
        raise SystemExit("playbook: the live slides %s must follow the bank order %s" % (asked, [q["id"] for q in bank]))
    orig_slides = BL.slides

    def slides(e, bank_, cfg, title, context):
        base = orig_slides(e, bank_, cfg, title, context)
        secs = re.findall(r'<section class="slide".*?</section>\n', base, re.S)
        join, board = secs[0], next(x for x in secs if "data-leaderboard" in x)
        parts, qn = [], 0
        for n, s in enumerate(src["slides"], 1):
            lv = s.get("live")
            notes = BT.notes_attr(s)
            if not lv:
                parts.append(BT.slide_html(n, s, src, "kp") + "\n"); continue
            if lv == "join":
                h = re.sub(r"<h1 data-reveal>.*?</h1>", '<h2 data-reveal>%s</h2>' % BT.T(s["headline"]), join, 1, flags=re.S)
                h = re.sub(r'<p class="kicker" data-reveal>.*?</p>', '<p class="kicker" data-reveal>Live round · %d questions on your phone</p>' % len(bank_), h, 1, flags=re.S)
            elif lv == "board":
                h = board.replace("<h2 data-reveal>Leaderboard</h2>", "<h2 data-reveal>%s</h2>" % BT.T(s["headline"]))
            else:
                qn += 1
                h = BL.question_slide(qn, len(bank_), by_id[lv], cfg)
                key = re.search(r'data-notes="([^"]*)"', h).group(1)
                notes = key + " " + notes
            h = re.sub(r'id="s\d+" data-min="[^"]*"', 'id="s%d" data-min="%s"' % (n, BT.fmt_min(float(s["min"]))), h, 1)
            h = re.sub(r'data-notes="[^"]*"', 'data-notes="%s"' % notes.replace("\\", "\\\\"), h, 1)
            parts.append(h)
        parts.append((HERE / "src" / "connect.html").read_text(encoding="utf-8").replace("sCONNECT", "s%d" % (len(src["slides"]) + 1)))   # KP's Stay in touch card, as on the RPE Machine deck
        return "".join(parts)

    BL.slides = slides
    prof = BL.BQ.load_profile("kp"); prof = dict(prof, nav_line=src["context"])
    BL.BQ.load_profile = lambda name: prof
    with tempfile.TemporaryDirectory() as tmp:                      # the live kit plus the talk and playbook layers
        kit = pathlib.Path(tmp)
        for f in BL.KIT.iterdir():
            shutil.copy2(f, kit / f.name)
        rd = lambda p: pathlib.Path(p).read_text(encoding="utf-8")   # noqa: E731
        (kit / "live.css").write_text(rd(BL.KIT / "live.css") + "\n" + rd(S / "arc-slides" / "assets" / "talk.css") + "\n" + rd(HERE / "src" / "play.css") + "\n" + rd(HERE / "src" / "connect.css"), encoding="utf-8")
        (kit / "live.js").write_text(rd(BL.KIT / "live.js") + "\n" + rd(S / "arc-slides" / "assets" / "talk.js") + "\n" + rd(HERE / "src" / "sim.js"), encoding="utf-8")
        BL.KIT = kit
        args = types.SimpleNamespace(backend=a.backend, api=a.api, firebase=None, sheet="", show="options", open_join=True)
        deck, cfg, e = BL.build(str(HERE / "quiz.json"), str(HERE / "bank.json"), str(files["slides"]), "kp", args)
    s = deck.read_text(encoding="utf-8")
    s = s.replace("<title>%s</title>" % BT.E(e["title"]), "<title>%s</title>" % BT.E(src["title"]), 1)
    deck.write_text(s, encoding="utf-8", newline="\n")
    print("playbook: wrote %s and %s · %s mode · %s" % (deck, files["script"], cfg["mode"], "live backend set" if a.api else "no backend (offline rhythm)"))


if __name__ == "__main__":
    main()
