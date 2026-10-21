# Journal finder playbook · source

RPE Unit 4 (open access, journal finders), 21 Oct 2026. Built with arc-slides (talk) and ace-live (live round) from `kp-skills`.

```
py build_playbook.py --skills <path to kp-skills> -o <out folder> [--api <Apps Script /exec URL>]
```

- `talk.json`: slides, notes and speaker script (arc-slides source).
- `quiz.json`, `bank.json`: the live round (6 questions). Seed the bank into the backend before a live run.
- `src/`: playbook styles, the simulated finder, journal-page and red-flag interactives, the Stay in touch slide.

The backend URL is passed on the command line only. Nothing secret lives in this folder.
