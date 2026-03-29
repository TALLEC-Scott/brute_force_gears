## v1 — July 2025 (Claude, first attempt)
![demo v1](demo_v1.gif)

## v2 — ChatGPT GUI agent (0-shot)
![output](https://github.com/user-attachments/assets/03c60030-da7b-4505-bc4d-5d12adbba17f)

## v3 — March 2026 (Claude Code, Sonnet/Opus 4.6)
![demo v3](demo_v3.gif)

This project tracks how AI coding agents have evolved over time at the same task.

**v1** was the first Claude attempt in July 2025.

**v2** was built using ChatGPT's GUI agent shortly after it launched (0-shot with a very detailed prompt). The agent iterated against itself by testing the GUI, producing an impressive result. I don't take credit for this one.

**v3** was built in March 2026 with Claude Code running Claude Sonnet/Opus 4.6 — 8 months later. The model now generates a physically correct SVG gear train: proper tooth geometry, correct meshing, gear sizes derived from mechanical coupling (`N_i = N_0 × (i+1)`), speed ratios that follow from tooth counts (`ω_i = ω_0 × N_0/N_i`), and unit tests. It requires considerably more back-and-forth than a 0-shot GUI agent and I ran out of credits before the session ended, but the mechanical correctness is a clear step change.

Perhaps I can see a scenario of using said agents for GUI targeted QA 🤔
