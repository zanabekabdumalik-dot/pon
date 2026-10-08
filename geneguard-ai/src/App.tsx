import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AnalysisPage } from './pages/Analysis';
import { ChatPage } from './pages/Chat';
import { HomePage } from './pages/Home';
import { PrivacyPage } from './pages/Privacy';
import { RecommendationsPage } from './pages/Recommendations';
import { ReportPage } from './pages/Report';
import { ReviewPage } from './pages/Review';
import { SourcesPage } from './pages/Sources';
import { UploadPage } from './pages/Upload';
import { PipelineProvider } from './state/pipeline';
import { SessionProvider } from './state/session';

export function App() {
  return (
    <SessionProvider>
      <PipelineProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="analysis" element={<AnalysisPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="*" element={<HomePage />} />
          </Route>
        </Routes>
      </PipelineProvider>
    </SessionProvider>
  );
}
