import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TopicPage from '@/pages/TopicPage';
import EditorPage from '@/pages/EditorPage';
import PlaybackPage from '@/pages/PlaybackPage';
import StatsPage from '@/pages/StatsPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TopicPage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
        <Route path="/play/:id" element={<PlaybackPage />} />
        <Route path="/stats/:id" element={<StatsPage />} />
      </Routes>
    </Router>
  );
}
