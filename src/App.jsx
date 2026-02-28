import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Instagram, RotateCcw, ChevronRight, Undo2, Trophy } from 'lucide-react';

// --- TRANSLATIONS ---
const i18n = {
  en: {
    title: "Atari GO (9x9)",
    black: "Black",
    white: "White",
    territory: "Territory",
    caps: "Caps",
    pointsRemaining: "Remaining",
    totalScore: "Total Score",
    turnSuffix: "'s Turn",
    passBtn: "Pass",
    resetBtn: "Reset",
    undoBtn: "Undo",
    rules: "<b>Scoring:</b> Total = Territory + Captures. White gets 6.5 Komi.",
    modalTitle: "Reset Game?",
    modalBody: "Clear board and scores? This cannot be undone.",
    modalCancel: "Cancel",
    modalConfirm: "Reset",
    suicideMsg: "Suicide move blocked!",
    koMsg: "Ko rule: Position repeat blocked.",
    gameOver: "Game Over! {winner} wins {b} to {w}",
    passedMsg: "{player} passed.",
    resetNotify: "Game Reset",
    undoNotify: "Undone"
  },
  pt: {
    title: "Atari GO (9x9)",
    black: "Preto",
    white: "Branco",
    territory: "Território",
    caps: "Capturas",
    pointsRemaining: "Restante",
    totalScore: "Pontuação Total",
    turnSuffix: " - Sua vez",
    passBtn: "Passar",
    resetBtn: "Reiniciar",
    undoBtn: "Desfazer",
    rules: "<b>Pontos:</b> Total = Território + Capturas. Branco recebe 6.5 Komi.",
    modalTitle: "Reiniciar?",
    modalBody: "Limpar tabuleiro e pontos? Não pode ser desfeito.",
    modalCancel: "Cancelar",
    modalConfirm: "Confirmar",
    suicideMsg: "Jogada suicida bloqueada!",
    koMsg: "Regra Ko: Repetição bloqueada.",
    gameOver: "Fim! {winner} vence por {b} a {w}",
    passedMsg: "{player} passou.",
    resetNotify: "Reiniciado",
    undoNotify: "Desfeito"
  }
};

const SIZE = 9;
const KOMI = 6.5;

// Custom Logo Component with Stone Dots
const Logo = () => (
  <div className="flex items-center gap-2 mb-2 group select-none">
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div className="absolute inset-0 bg-black rounded-full shadow-lg group-hover:rotate-12 transition-transform duration-300"></div>
      <div className="absolute inset-1 border border-white border-opacity-10 rounded-full"></div>
      <div className="relative z-10 grid grid-cols-2 gap-1.5 p-1">
        <div className="w-2 h-2 rounded-full bg-white shadow-sm"></div>
        <div className="w-2 h-2 rounded-full bg-gray-600"></div>
        <div className="w-2 h-2 rounded-full bg-gray-800"></div>
        <div className="w-2 h-2 rounded-full bg-white shadow-sm"></div>
      </div>
    </div>
    <div className="flex flex-col leading-none text-left">
      <span className="text-xl font-black text-gray-800 tracking-tighter uppercase">Atari GO</span>
      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">OG Strategy</span>
    </div>
  </div>
);

export default function App() {
  // --- SEO & CANONICAL SYNC ---
  useEffect(() => {
    const siteUrl = "https://atari-go.vercel.app/";
    document.title = "Atari GO - Play 9x9 Strategic Go Online";
    
    const metaDesc = document.querySelector('meta[name="description"]') || document.createElement('meta');
    metaDesc.name = "description";
    metaDesc.content = "Play Atari GO (9x9), the ultimate strategic board game. Master territory surrounding and stone capturing. Created by OG.";
    if (!metaDesc.parentNode) document.head.appendChild(metaDesc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = siteUrl;
  }, []);

  // --- STATE ---
  const [board, setBoard] = useState(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [captures, setCaptures] = useState({ 1: 0, 2: 0 });
  const [lastBoardState, setLastBoardState] = useState(null);
  const [history, setHistory] = useState([]); 
  const [passCount, setPassCount] = useState(0);
  const [lang, setLang] = useState('en');
  const [message, setMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const t = i18n[lang];

  // --- LOGIC HELPERS ---
  const findGroupAndLiberties = useCallback((tempBoard, r, c) => {
    const color = tempBoard[r][c];
    if (color === 0) return { group: [], liberties: [] };
    const queue = [{ r, c }];
    const visited = new Set([`${r},${c}`]);
    const group = [];
    const liberties = new Set();

    while (queue.length > 0) {
      const curr = queue.shift();
      group.push(curr);
      const neighbors = [{ r: curr.r - 1, c: curr.c }, { r: curr.r + 1, c: curr.c }, { r: curr.r, c: curr.c - 1 }, { r: curr.r, c: curr.c + 1 }];
      for (const n of neighbors) {
        if (n.r >= 0 && n.r < SIZE && n.c >= 0 && n.c < SIZE) {
          if (tempBoard[n.r][n.c] === 0) liberties.add(`${n.r},${n.c}`);
          else if (tempBoard[n.r][n.c] === color && !visited.has(`${n.r},${n.c}`)) {
            visited.add(`${n.r},${n.c}`);
            queue.push(n);
          }
        }
      }
    }
    return { group, liberties: Array.from(liberties) };
  }, []);

  const findCaptures = useCallback((tempBoard, opponentColor) => {
    const captured = [];
    const processed = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (tempBoard[r][c] === opponentColor && !processed.has(`${r},${c}`)) {
          const { group, liberties } = findGroupAndLiberties(tempBoard, r, c);
          group.forEach(stone => processed.add(`${stone.r},${stone.c}`));
          if (liberties.length === 0) captured.push(...group);
        }
      }
    }
    return captured;
  }, [findGroupAndLiberties]);

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
    setTimeout(() => setMessage(''), 2500);
  };

  const handleMove = (r, c) => {
    if (board[r][c] !== 0) return;

    const testBoard = board.map(row => [...row]);
    testBoard[r][c] = currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;
    
    const captured = findCaptures(testBoard, opponent);
    captured.forEach(pos => testBoard[pos.r][pos.c] = 0);

    if (captured.length === 0) {
      const { liberties } = findGroupAndLiberties(testBoard, r, c);
      if (liberties.length === 0) {
        showFlashMessage(t.suicideMsg);
        return;
      }
    }

    const boardString = JSON.stringify(testBoard);
    if (boardString === lastBoardState) {
      showFlashMessage(t.koMsg);
      return;
    }

    setHistory(prev => [...prev, {
      board: board.map(row => [...row]),
      currentPlayer,
      captures: { ...captures },
      lastBoardState
    }]);

    setLastBoardState(JSON.stringify(board));
    setBoard(testBoard);
    setCaptures(prev => ({ ...prev, [currentPlayer]: prev[currentPlayer] + captured.length }));
    setPassCount(0);
    setCurrentPlayer(opponent);
  };

  const undoMove = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setBoard(last.board);
    setCurrentPlayer(last.currentPlayer);
    setCaptures(last.captures);
    setLastBoardState(last.lastBoardState);
    setHistory(prev => prev.slice(0, -1));
    showFlashMessage(t.undoNotify);
  };

  const handlePass = () => {
    setHistory(prev => [...prev, {
      board: board.map(row => [...row]),
      currentPlayer,
      captures: { ...captures },
      lastBoardState
    }]);
    const nextPass = passCount + 1;
    if (nextPass >= 2) {
      const b = scoreData.blackTerritory + captures[1];
      const w = scoreData.whiteTerritory + captures[2] + KOMI;
      const winner = b > w ? t.black : t.white;
      showFlashMessage(t.gameOver.replace('{winner}', winner).replace('{b}', b.toFixed(1)).replace('{w}', w.toFixed(1)));
    } else {
      showFlashMessage(t.passedMsg.replace('{player}', currentPlayer === 1 ? t.black : t.white));
    }
    setPassCount(nextPass);
    setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
  };

  const resetGame = () => {
    setBoard(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
    setCurrentPlayer(1);
    setCaptures({ 1: 0, 2: 0 });
    setHistory([]);
    setPassCount(0);
    setShowResetModal(false);
    showFlashMessage(t.resetNotify);
  };

  const isHoshi = (r, c) => [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]].some(p => p[0] === r && p[1] === c);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 font-sans p-2 sm:p-4 pb-20 sm:pt-12">
      
      {/* Mobile-Friendly Language Toggle */}
      <div className="fixed top-2 right-2 z-50 flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {['en', 'pt'].map(l => (
          <button 
            key={l}
            onClick={() => setLang(l)}
            className={`px-2.5 py-1.5 text-[10px] font-bold transition-colors ${lang === l ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl flex flex-col items-center p-3 sm:p-6 border border-gray-200">
        <Logo />
        
        {/* Scoreboard - Optimized for Mobile Viewports */}
        <div className="grid grid-cols-3 w-full mb-4 px-2 bg-gray-50 py-3 rounded-xl border border-gray-200 gap-1">
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full bg-black shadow-sm ${currentPlayer === 1 ? 'ring-2 ring-blue-400' : ''}`}></div>
              <span className="font-bold text-[10px] sm:text-xs truncate">{t.black}</span>
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.territory}: {scoreData.blackTerritory}</p>
            <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.caps}: {captures[1]}</p>
            <p className="text-sm sm:text-base font-black text-black">{(scoreData.blackTerritory + captures[1]).toFixed(1)}</p>
          </div>

          <div className="flex flex-col items-center justify-center border-x border-gray-200 text-center">
            <div className="text-[8px] font-black text-blue-600 uppercase tracking-tighter mb-0.5 truncate w-full">
              {currentPlayer === 1 ? t.black : t.white}{t.turnSuffix}
            </div>
            <div className="text-[7px] text-gray-400 font-bold uppercase whitespace-nowrap">
              {scoreData.emptyCount} {t.pointsRemaining}
            </div>
          </div>

          <div className="flex flex-col items-end text-right min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="font-bold text-[10px] sm:text-xs truncate">{t.white}</span>
              <div className={`w-2.5 h-2.5 rounded-full bg-white border border-gray-300 shadow-sm ${currentPlayer === 2 ? 'ring-2 ring-blue-400' : ''}`}></div>
            </div>
            <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.territory}: {scoreData.whiteTerritory}</p>
            <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.caps}: {captures[2]}</p>
            <p className="text-sm sm:text-base font-black text-gray-700">{(scoreData.whiteTerritory + captures[2] + KOMI).toFixed(1)}</p>
          </div>
        </div>

        {/* Board - Fixed Scroll Jump with Stable Container */}
        <div className="relative p-2 sm:p-4 rounded-xl shadow-inner mb-4 select-none touch-none bg-[#dbb06d] border-4 border-[#c19a5b]">
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")'}}></div>
            <div className="relative z-10">
                <div className="grid grid-cols-8 grid-rows-8 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] border border-black border-opacity-70">
                    {Array(64).fill(0).map((_, i) => <div key={i} className="border-[0.5px] border-black border-opacity-30"></div>)}
                </div>
                <div className="absolute top-0 left-0 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px]">
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
                            {isHoshi(r, c) && cell === 0 && <div className="absolute w-1 h-1 bg-black bg-opacity-60 rounded-full"></div>}
                            {cell === 0 && <div className={`w-4/5 h-4/5 rounded-full opacity-0 group-hover/cell:opacity-30 transition-opacity ${currentPlayer === 1 ? 'bg-black' : 'bg-white border'}`}></div>}
                            {cell !== 0 && (
                                <div className={`w-[90%] h-[90%] rounded-full shadow-md animate-in fade-in zoom-in duration-200 ${cell === 1 ? 'bg-gradient-to-br from-gray-700 to-black' : 'bg-gradient-to-br from-white to-gray-200 border border-gray-300'}`}></div>
                            )}
                        </div>
                    )))}
                </div>
            </div>
        </div>

        {/* HUD Messaging Area */}
        <div className="h-6 mb-2 flex items-center justify-center">
            {message && <div className="px-3 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-bold shadow-sm animate-pulse whitespace-nowrap">{message}</div>}
        </div>

        {/* Action Controls - Mobile Optimized Grid */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
            <button onClick={undoMove} disabled={history.length === 0} className="flex flex-col items-center justify-center py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-500 disabled:opacity-20 active:scale-95 transition-all shadow-sm">
                <Undo2 size={14} className="text-gray-600" /><span className="text-[9px] font-black mt-0.5 text-gray-500 uppercase">{t.undoBtn}</span>
            </button>
            <button onClick={handlePass} className="flex flex-col items-center justify-center py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-500 active:scale-95 transition-all shadow-sm">
                <ChevronRight size={14} className="text-gray-600" /><span className="text-[9px] font-black mt-0.5 text-gray-500 uppercase">{t.passBtn}</span>
            </button>
            <button onClick={() => setShowResetModal(true)} className="flex flex-col items-center justify-center py-2 bg-red-50 border border-red-100 rounded-xl text-red-600 active:scale-95 transition-all shadow-sm">
                <RotateCcw size={14} /><span className="text-[9px] font-black mt-0.5 uppercase">{t.resetBtn}</span>
            </button>
        </div>

        {/* Global Footer & Branding */}
        <div className="w-full mt-6 pt-4 border-t border-gray-100 flex flex-col items-center">
            <div className="text-center text-[8px] text-gray-400 mb-4 leading-tight max-w-[200px] sm:max-w-none" dangerouslySetInnerHTML={{ __html: t.rules }}></div>
            
            <div className="w-full py-3 bg-gray-50 rounded-xl flex flex-col items-center gap-1 border border-gray-200">
                <p className="text-[8px] text-gray-400 uppercase tracking-widest font-black flex items-center gap-1">
                    <Trophy size={8} className="text-yellow-600" /> CREATED BY <span className="text-gray-700 font-bold">OG</span>
                </p>
                <a 
                    href="https://www.instagram.com/0g_2k6?igsh=dWE1cnQ1cjUwenJi" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1 bg-white rounded-full shadow-sm border border-gray-200 hover:text-pink-600 transition-all text-[10px] font-bold text-gray-700 group"
                >
                    <Instagram size={10} className="group-hover:rotate-12 transition-transform" />
                    <span>@0g_2k6</span>
                </a>
            </div>
        </div>
      </div>

      {/* Modern Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-[280px] w-full animate-in zoom-in slide-in-from-bottom-2 duration-200">
                <h3 className="text-base font-black mb-1 text-gray-900">{t.modalTitle}</h3>
                <p className="text-gray-500 text-[10px] mb-6 leading-relaxed">{t.modalBody}</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowResetModal(false)} className="flex-1 py-2 text-[10px] text-gray-500 font-bold hover:bg-gray-50 rounded-lg">{t.modalCancel}</button>
                    <button onClick={resetGame} className="flex-1 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg shadow-lg shadow-red-200">{t.modalConfirm}</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}