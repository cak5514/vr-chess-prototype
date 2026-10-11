import { isSquare } from "./core/index";
import "./style.css";

// Step 1 placeholder page. The real menu and board arrive in step 3.
const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <main class="welcome">
    <h1>VR Chess Academy</h1>
    <p>Project scaffold is running.</p>
    <p class="check">core/ check: "e4" is ${isSquare("e4") ? "a valid" : "an invalid"} square.</p>
  </main>
`;
