import { ChatWindow } from './components/ChatWindow';
import { Toaster } from 'sonner';
import './App.css';

function App() {
  return (
    <div className="app">
      <Toaster position="top-center" richColors expand style={{ zIndex: 2147483647 }} />
      <ChatWindow isEmbedded={false} />
    </div>
  );
}

export default App;
