# Orthodox Digital Library maintenance

1. Register a new author in `authors.json` with a lowercase ASCII, hyphenated ID, display name, and brief verified biography. Make the same ID directory under `english/` and `arabic/`; keep a `.gitkeep` in empty directories. Use `other-authors` only with an explicit per-book author name.
2. Add approved PDFs to the matching folder, such as `english/pope-shenouda-iii/` or `arabic/pope-shenouda-iii/`. Nested folders and Unicode filenames are supported. Do not add files to the public site tree until permission is established: an uncataloged file can still be served by its URL.
3. Optionally add a rights-cleared portrait under `assets/images/book-authors/` or reuse an existing asset. Set the author's `portrait` to its site-relative path in `authors.json`. Empty authors are not displayed.
4. In `metadata.json`, use the path relative to `assets/books/` as the key (literal filename, not URL encoding). Optional fields include `title`, `titleLanguage`, `description`, `subject`, `cover`, `publication`, `publisher`, and `sourceUrl`. For new or replaced PDFs, set `distributionStatus` to `approved` and record the permission basis in `permission` after review. Do not infer rights from the existence of a download.
5. From the repository root, run `node scripts/generate-book-catalog.mjs`. This updates `catalog.json` and its browser companion `catalog.js`. Generation is manual; no deployment configuration was changed.
6. Open `books.html` in a browser to preview. To test downloads, serve the repository root with `python3 -m http.server 8010 --bind 127.0.0.1` and open `http://127.0.0.1:8010/books.html`; browsers may ignore the download attribute on file URLs. Search for the new title and try both Read PDF and Download PDF. Include the approved PDF, metadata and both generated catalogs together when committing.

## Migration and rights

`migration-inventory.json` lists the original paths and SHA-256 hashes. The same filenames now live under `pope-shenouda-iii/`. The existing collection is retained, not certified for redistribution. Some scanned books retain the parish's prior attribution pending title-page verification. Eight Arabic titles come from the PDF metadata or front matter; other titles use existing filenames until verified Arabic titles are available.

Two copies of Feast of Nativity Volume 2 in Arabic are byte-identical. Both remain on disk; only the original filename is cataloged. Newly added files without approval, unidentified files, and repeated content are reported by the generator.
