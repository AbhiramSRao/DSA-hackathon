# Student Index Recovery System

This folder contains the complete two-page website and its local backend. Open this folder in VS Code; do not open only an individual HTML file.

## Run the full website

1. Install Python 3 and a C compiler (GCC or Clang), with the compiler available on `PATH`.
2. Double-click `START_SERVER.bat` (or run `python app.py` in the VS Code terminal).
3. Open `http://127.0.0.1:8000` in your browser.
4. Keep the server window open while using the recovery lab.

The frontend sends input to the Python API. The API compiles and runs `backend.c`. The C program performs fragment merging, connectivity and fragment-use checks, full BST range validation, and inorder traversal. Python is only the HTTP bridge and static-file server.

If you open `index.html` directly from File Explorer, the pages will display but the recovery API will not run; start the server as above.

See `BACKEND.md` for the API format and algorithm notes.
