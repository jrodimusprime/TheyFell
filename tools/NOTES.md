# Rebuilding the guide

Run from the repository root:

```bash
python3 tools/gen_system.py      # images/trench-system-3d.svg
python3 tools/gen_section.py     # images/fire-trench-section-3d.svg
rsvg-convert -w 1500 images/trench-system-3d.svg -o images/trench-system-3d.png
rsvg-convert -w 1400 images/fire-trench-section-3d.svg -o images/fire-trench-section-3d.png
python3 tools/build.py           # README.tmpl.md -> README.md
```

`README.tmpl.md` uses two tags that `build.py` expands into Wikimedia Commons image HTML:

- `[[IMG File_name.jpg | caption | width]]`: one centred image
- `[[ROW File_a.jpg | caption a ;; File_b.jpg | caption b]]`: images side by side

The Commons file name is all you need. The script derives the `upload.wikimedia.org` URL from the file name's MD5 hash, and writes every resolved URL to `tools/image_manifest.tsv`.
