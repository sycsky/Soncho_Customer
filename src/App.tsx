import React from 'react';
import { ChatWindow } from './components/ChatWindow';
import './App.css';

function App() {
  return (
    <div className="app">
      <ChatWindow isEmbedded={false} />
    </div>
  );
}

export default App;
