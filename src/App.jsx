import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Instagram, Globe, RotateCcw, ChevronRight } from 'lucide-react';

// --- TRANSLATIONS ---
const i18n = {
  en: {
    title: "Go (9x9)",
    black: "Black",
    white: "White",
    territory: "Territory",
    caps: "Caps",
    pointsRemaining: "Points Remaining",
    turnSuffix: "'s Turn",
    passBtn: "Pass",
    resetBtn: "Reset Game",
    rules: "<b>Scoring:</b> Points = Territory + Captures. White receives 6.5 points (Komi) to compensate for going second.",
    modalTitle: "Reset Game?",
    modalBody: "This will clear the board and reset all scores. This cannot be undone.",
    modalCancel: "Cancel",
    modalConfirm: "Reset Now",
    suicideMsg: "Suicide move is not allowed!",
    koMsg: "Ko rule: Cannot repeat position.",
    gameOver: "Game Over! {winner} wins {b} to {w}",
    passedMsg: "{player} passed.",
    resetNotify: "Game Reset"
  },
  pt: {
    title: "Go (9x9)",
    black: "Preto",
    white: "Branco",
    territory: "Território",
    caps: "Capturas",
    pointsRemaining: "Pontos Restantes",
    turnSuffix: " - Sua vez",
    passBtn: "Passar",
    resetBtn: "Reiniciar",
    rules: "<b>Pontuação:</b> Pontos = Território + Capturas. O Branco recebe 6.5 pontos (Komi) por começar em segundo.",
    modalTitle: "Reiniciar Jogo?",
    modalBody: "Isso limpará o tabuleiro e resetará os pontos. Não pode ser desfeito.",
    modalCancel: "Cancelar",
    modalConfirm: "Confirmar",
    suicideMsg: "Jogada suicida não é permitida!",
    koMsg: "Regra Ko: Não pode repetir a posição.",
    gameOver: "Fim de Jogo! {winner} vence por {b} a {w}",
    passedMsg: "{player} passou.",
    resetNotify: "Jogo Reiniciado"
  }
};

const SIZE = 9;
const KOMI = 6.5;

export default function App() {
  // --- STATE ---
  const [board, setBoard] = useState(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
  const [currentPlayer, setCurrentPlayer] = useState(1); // 1: Black, 2: White
  const [captures, setCaptures] = useState({ 1: 0, 2: 0 });
  const [lastBoardState, setLastBoardState] = useState(null);
  const [passCount, setPassCount] = useState(0);
  const [lang, setLang] = useState('en');
  const [message, setMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const t = i18n[lang];

  // --- LOGIC HELPERS ---
  const getLiberties = useCallback((tempBoard, r, c) => {
    const color = tempBoard[r][c];
    if (color === 0) return [];
    const queue = [{ r, c }];
    const visited = new Set([`${r},${c}`]);
    const liberties = new Set();

    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = [
        { r: curr.r - 1, c: curr.c },
        { r: curr.r + 1, c: curr.c },
        { r: curr.r, c: curr.c - 1 },
        { r: curr.r, c: curr.c + 1 }
      ];
      for (const n of neighbors) {
        if (n.r >= 0 && n.r < SIZE && n.c >= 0 && n.c < SIZE) {
          if (tempBoard[n.r][n.c] === 0) {
            liberties.add(`${n.r},${n.c}`);
          } else if (tempBoard[n.r][n.c] === color && !visited.has(`${n.r},${n.c}`)) {
            visited.add(`${n.r},${n.c}`);
            queue.push(n);
          }
        }
      }
    }
    return Array.from(liberties);
  }, []);

  const findCaptures = useCallback((tempBoard, color) => {
    const captured = [];
    const processed = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (tempBoard[r][c] === color && !processed.has(`${r},${c}`)) {
          const group = [];
          const queue = [{ r, c }];
          const visited = new Set([`${r},${c}`]);
          let hasLiberty = false;
          while (queue.length > 0) {
            const curr = queue.shift();
            group.push(curr);
            processed.add(`${curr.r},${curr.c}`);
            const neighbors = [{ r: curr.r - 1, c: curr.c }, { r: curr.r + 1, c: curr.c }, { r: curr.r, c: curr.c - 1 }, { r: curr.r, c: curr.c + 1 }];
            for (const n of neighbors) {
              if (n.r >= 0 && n.r < SIZE && n.c >= 0 && n.c < SIZE) {
                if (tempBoard[n.r][n.c] === 0) hasLiberty = true;
                else if (tempBoard[n.r][n.c] === color && !visited.has(`${n.r},${n.c}`)) {
                  visited.add(`${n.r},${n.c}`);
                  queue.push(n);
                }
              }
            }
          }
          if (!hasLiberty) captured.push(...group);
        }
      }
    }
    return captured;
  }, []);

  const scoreData = useMemo(() => {
    let blackTerritory = 0;
    let whiteTerritory = 0;
    let emptyCount = 0;
    const visited = new Set();

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0 && !visited.has(`${r},${c}`)) {
          emptyCount++;
          const area = [];
          const queue = [{ r, c }];
          visited.add(`${r},${c}`);
          const borders = new Set();

          while (queue.length > 0) {
            const curr = queue.shift();
            area.push(curr);
            const neighbors = [{ r: curr.r - 1, c: curr.c }, { r: curr.r + 1, c: curr.c }, { r: curr.r, c: curr.c - 1 }, { r: curr.r, c: curr.c + 1 }];
            for (const n of neighbors) {
              if (n.r >= 0 && n.r < SIZE && n.c >= 0 && n.c < SIZE) {
                if (board[n.r][n.c] === 0 && !visited.has(`${n.r},${n.c}`)) {
                  visited.add(`${n.r},${n.c}`);
                  queue.push(n);
                  emptyCount++;
                } else if (board[n.r][n.c] !== 0) {
                  borders.add(board[n.r][n.c]);
                }
              }
            }
          }
          if (borders.size === 1) {
            if (borders.has(1)) blackTerritory += area.length;
            else if (borders.has(2)) whiteTerritory += area.length;
          }
        }
      }
    }
    return { blackTerritory, whiteTerritory, emptyCount };
  }, [board]);

  // --- ACTIONS ---
  const showFlashMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleMove = (r, c) => {
    if (board[r][c] !== 0) return;

    const testBoard = board.map(row => [...row]);
    testBoard[r][c] = currentPlayer;

    const opponent = currentPlayer === 1 ? 2 : 1;
    const captured = findCaptures(testBoard, opponent);
    
    captured.forEach(pos => testBoard[pos.r][pos.c] = 0);

    if (captured.length === 0) {
      if (getLiberties(testBoard, r, c).length === 0) {
        showFlashMessage(t.suicideMsg);
        return;
      }
    }

    const boardString = JSON.stringify(testBoard);
    if (boardString === lastBoardState) {
      showFlashMessage(t.koMsg);
      return;
    }

    setLastBoardState(JSON.stringify(board));
    setBoard(testBoard);
    setCaptures(prev => ({
      ...prev,
      [currentPlayer]: prev[currentPlayer] + captured.length
    }));
    setPassCount(0);
    setCurrentPlayer(opponent);
  };

  const handlePass = () => {
    const nextPassCount = passCount + 1;
    const playerJustPassed = currentPlayer === 1 ? t.black : t.white;
    
    if (nextPassCount >= 2) {
      const b = scoreData.blackTerritory + captures[1];
      const w = scoreData.whiteTerritory + captures[2] + KOMI;
      const winnerLabel = b > w ? t.black : t.white;
      showFlashMessage(t.gameOver.replace('{winner}', winnerLabel).replace('{b}', b).replace('{w}', w));
    } else {
      showFlashMessage(t.passedMsg.replace('{player}', playerJustPassed));
    }
    
    setPassCount(nextPassCount);
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
  };

  const resetGame = () => {
    setBoard(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
    setCurrentPlayer(1);
    setCaptures({ 1: 0, 2: 0 });
    setLastBoardState(null);
    setPassCount(0);
    setShowResetModal(false);
    showFlashMessage(t.resetNotify);
  };

  // --- RENDER HELPERS ---
  const isHoshi = (r, c) => {
    const points = [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
    return points.some(p => p[0] === r && p[1] === c);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100 font-sans">
      
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <button 
          onClick={() => setLang('en')}
          className={`px-4 py-2 text-xs font-bold transition-colors ${lang === 'en' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}
        >
          EN
        </button>
        <button 
          onClick={() => setLang('pt')}
          className={`px-4 py-2 text-xs font-bold transition-colors ${lang === 'pt' ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}
        >
          PT
        </button>
      </div>

      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-6 border border-gray-200">
        <h1 className="text-3xl font-black mb-6 text-gray-800 tracking-tight">{t.title}</h1>
        
        {/* Scoreboard */}
        <div className="grid grid-cols-3 w-full mb-8 px-4 bg-gray-50 py-5 rounded-2xl border border-gray-200 shadow-inner">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full bg-black shadow-md ${currentPlayer === 1 ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}`}></div>
              <span className="font-bold text-sm text-gray-700">{t.black}</span>
            </div>
            <p className="text-[10px] text-gray-500 mb-1">{t.territory}: {scoreData.blackTerritory} | {t.caps}: {captures[1]}</p>
            <p className="text-xl font-black text-black">{(scoreData.blackTerritory + captures[1]).toFixed(1)} <span className="text-[10px] font-normal opacity-50">pts</span></p>
          </div>

          <div className="flex flex-col items-center justify-center border-x border-gray-200">
            <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">
              {currentPlayer === 1 ? t.black : t.white}{t.turnSuffix}
            </div>
            <div className="text-[9px] text-gray-400 font-bold uppercase">
              {scoreData.emptyCount} {t.pointsRemaining}
            </div>
          </div>

          <div className="flex flex-col items-end text-right">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm text-gray-700">{t.white}</span>
              <div className={`w-4 h-4 rounded-full bg-white border border-gray-300 shadow-sm ${currentPlayer === 2 ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}`}></div>
            </div>
            <p className="text-[10px] text-gray-500 mb-1">{t.territory}: {scoreData.whiteTerritory} | {t.caps}: {captures[2]} | Komi: 6.5</p>
            <p className="text-xl font-black text-gray-700">{(scoreData.whiteTerritory + captures[2] + KOMI).toFixed(1)} <span className="text-[10px] font-normal opacity-50">pts</span></p>
          </div>
        </div>

        {/* Board */}
        <div className="relative p-6 sm:p-10 rounded-xl shadow-2xl overflow-hidden group">
            {/* Wood background pattern */}
            <div className="absolute inset-0 bg-[#dbb06d] opacity-90" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")'}}></div>
            
            <div className="relative z-10">
                {/* Grid Lines */}
                <div className="grid grid-cols-8 grid-rows-8 w-72 h-72 sm:w-96 sm:h-96 border-[1.5px] border-black border-opacity-80">
                    {Array(64).fill(0).map((_, i) => (
                        <div key={i} className="border-[0.5px] border-black border-opacity-60 box-border"></div>
                    ))}
                </div>

                {/* Intersections Layer */}
                <div className="absolute top-0 left-0 w-72 h-72 sm:w-96 sm:h-96">
                    {board.map((row, r) => row.map((cell, c) => (
                        <div 
                            key={`${r}-${c}`}
                            onClick={() => handleMove(r, c)}
                            className="absolute flex items-center justify-center cursor-pointer group/cell"
                            style={{
                                top: `${(r / (SIZE - 1)) * 100}%`,
                                left: `${(c / (SIZE - 1)) * 100}%`,
                                width: '11.11%',
                                height: '11.11%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 20
                            }}
                        >
                            {/* Star points (Hoshi) */}
                            {isHoshi(r, c) && cell === 0 && (
                                <div className="absolute w-2 h-2 bg-black bg-opacity-80 rounded-full z-0 pointer-events-none"></div>
                            )}

                            {/* Ghost Stone */}
                            {cell === 0 && (
                                <div className={`w-5/6 h-5/6 rounded-full opacity-0 group-hover/cell:opacity-40 pointer-events-none transition-opacity duration-150 ${currentPlayer === 1 ? 'bg-black' : 'bg-white border border-gray-300'}`}></div>
                            )}

                            {/* Actual Stone */}
                            {cell !== 0 && (
                                <div className={`w-[90%] h-[90%] rounded-full shadow-lg transform scale-100 animate-in fade-in zoom-in duration-200 ${cell === 1 ? 'bg-gradient-to-br from-gray-700 to-black' : 'bg-gradient-to-br from-white to-gray-200 border border-gray-300'}`}></div>
                            )}
                        </div>
                    )))}
                </div>
            </div>
        </div>

        {/* Messaging & Controls */}
        <div className="h-10 mt-6 flex items-center justify-center">
            {message && (
                <div className="px-4 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100 animate-bounce">
                    {message}
                </div>
            )}
        </div>

        <div className="flex gap-4 w-full justify-center">
            <button 
                onClick={handlePass}
                className="flex items-center gap-2 px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-xl transition-all active:scale-95"
            >
                <ChevronRight size={18} />
                {t.passBtn}
            </button>
            <button 
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-2 px-8 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-black rounded-xl transition-all active:scale-95"
            >
                <RotateCcw size={18} />
                {t.resetBtn}
            </button>
        </div>

        {/* Footer info */}
        <div className="w-full mt-10 pt-6 border-t border-gray-100 flex flex-col items-center">
            <div className="max-w-sm text-center text-[10px] text-gray-400 mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: t.rules }}></div>
            
            <div className="w-full py-4 bg-gray-50 rounded-xl flex flex-col items-center gap-2">
                <p className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">
                    Created by <span className="text-black">OG</span>
                </p>
                <a 
                    href="https://www.instagram.com/0g_2k6?igsh=dWE1cnQ1cjUwenJi" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200 hover:border-pink-500 hover:text-pink-500 transition-all text-sm font-semibold text-gray-700 group"
                >
                    <Instagram size={16} className="group-hover:scale-110 transition-transform" />
                    <span>@0g_2k6</span>
                </a>
            </div>
        </div>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full animate-in zoom-in slide-in-from-bottom-4 duration-300">
                <h3 className="text-xl font-black mb-2 text-gray-900">{t.modalTitle}</h3>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed">{t.modalBody}</p>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowResetModal(false)}
                        className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        {t.modalCancel}
                    </button>
                    <button 
                        onClick={resetGame}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-200 transition-all"
                    >
                        {t.modalConfirm}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}