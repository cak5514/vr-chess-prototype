# Stockfish engine files

These two files are the chess engine the computer opponent uses:

- `stockfish-19-lite-single.js`
- `stockfish-19-lite-single.wasm`

They are the "lite, single-threaded" build of Stockfish 19 from the
[stockfish.js](https://github.com/nmrugg/stockfish.js) project (npm package
`stockfish` version 19.0.1), copied here unchanged. This build was chosen
because it is small (about 1.8 MB) and works on any static web host with no
special server settings.

Stockfish is licensed under the GPL v3. See `Copying.txt`.
