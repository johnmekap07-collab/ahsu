import React from 'react';
import FlappyGame from './components/FlappyGame';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-slate-900 flex flex-col">
      <FlappyGame />
    </div>
  );
};

export default App;