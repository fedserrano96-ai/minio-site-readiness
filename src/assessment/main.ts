// Bundle entry for screen 2. index.html calls window.MiniOAssessment.start(snapshot) or
// .restore(). The page listens for `minio:edit-yard` on document.
import './styles.css';
import { createApp } from './ui/app';

declare global {
  interface Window { MiniOAssessment: ReturnType<typeof createApp> }
}

const root = document.getElementById('assessment-root');
if (!root) throw new Error('#assessment-root not found: the page must contain it before this script runs');

window.MiniOAssessment = createApp(root, {
  fetchFn: fetch.bind(window),
  storage: sessionStorage,
  navigate: (url) => window.location.assign(url),
  print: () => window.print(),
});
