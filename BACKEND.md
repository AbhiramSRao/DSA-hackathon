# Student Index Recovery backend

The browser sends fragment data to the local Python HTTP server. The server compiles and invokes `backend.c`; all recovery decisions and BST operations are performed in C. Python only serves the pages, validates the JSON shape, translates the C response, and returns JSON to the page.

## Requirements

- Python 3
- GCC or Clang available on `PATH`

On Windows, install a GCC toolchain such as MinGW-w64 and add its `bin` directory to `PATH`. Open a new terminal after changing `PATH`.

## Run

Open PowerShell in this project folder and run:

```powershell
python app.py
```

Then open `http://127.0.0.1:8000` in your browser. Keep the terminal running while using the site. Press `Ctrl+C` in that terminal to stop the server.

`app.py` compiles `backend.c` to `recovery_engine.exe` when the server starts. The API endpoint is `POST /api/recover` and accepts:

```json
{
  "fragments": [
    { "root": 3, "left": 2, "right": 5 },
    { "root": 2, "left": 1, "right": null },
    { "root": 5, "left": 4, "right": null }
  ]
}
```

The C program uses `-1` internally for an empty child; user IDs must be non-negative integers. The API returns either a merged tree, root, inorder list and fragment counts, or `ok: false` with an explanation. The frontend renders the merged tree, traversal, recovery trace, or failure reason.

## C algorithm

The C engine uses fixed-size arrays sized for the assignment limit. It checks fragment shape and root uniqueness, finds the one root not referenced as a child, connects fragments by matching a child leaf ID to another fragment's root, detects repeated use and unused fragments, validates the complete tree with recursive lower and upper bounds, and creates an inorder traversal. It uses no built-in tree, sorting, or search data-structure functions for the DSA logic.
