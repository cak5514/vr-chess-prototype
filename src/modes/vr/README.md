# VR mode (Phase 2, not built yet)

WebXR mode for a VR headset. It will reuse the Three.js board from
`ui/board/board3d` and send moves into the game through `attemptMove(from, to)`
from `core/index.ts`, exactly like the mouse does.
