import * as Tooltip from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { EditorLoader } from './components/Editor';
import { About } from './pages/About';
import { Help } from './pages/Help';
import { useRoute } from './router';
import { Tour } from './tour/Tour';
import { ConfirmProvider } from './ui/Dialog';
import { ErrorBoundary } from './ui/ErrorBoundary';

export function App() {
  const route = useRoute();
  return (
    <Tooltip.Provider delayDuration={400}>
      <ConfirmProvider>
        <ErrorBoundary name="niimai">
          {route === 'help' ? <Help /> : route === 'about' ? <About /> : <EditorLoader />}
        </ErrorBoundary>
        <ErrorBoundary name="Tour" fallback={() => null}>
          <Tour />
        </ErrorBoundary>
        <Toaster position="bottom-center" theme="system" richColors closeButton />
      </ConfirmProvider>
    </Tooltip.Provider>
  );
}
