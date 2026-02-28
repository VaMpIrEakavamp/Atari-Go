import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Instagram, RotateCcw, ChevronRight, Undo2, Trophy, Swords, Zap, Layout, Globe, Copy, User, CheckCircle2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
// These constants are provided by the environment at runtime
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'atari-go-default';

// --- TRANSLATIONS ---
const i18n = {
  en: {
    title: "Atari GO (9x9)",
    black: "Black",
    white: "White",
    territory: "Territory",
    caps: "Captures",
    pointsRemaining: "Remaining",
    turnSuffix: "'s Turn",
    passBtn: "Pass",
    resetBtn: "Reset",
    undoBtn: "Undo",
    rules: "<b>Scoring:</b> Total = Territory + Captures. White gets 6.5 Komi.",
    killRules: "<b>Kill Mode:</b> First player to capture a stone wins instantly!",
    modalTitle: "Reset Game?",
    modalBody: "Clear board and scores? This cannot be undone.",
    modalCancel: "Cancel",
    modalConfirm: "Reset",
    suicideMsg: "Suicide move blocked!",
    koMsg: "Ko rule: Position repeat blocked.",
    gameOver: "Game Over! {winner} wins {b} to {w}",
    killWin: "Kill! {winner} captured a stone and wins!",
    passedMsg: "{player} passed.",
    resetNotify: "Game Reset",
    undoNotify: "Undone",
    modeClassic: "Classic Go",
    modeKill: "Kill Mode",
    playOnline: "Play Online",
    copyLink: "Copy Link",
    onlineAs: "Playing as:",
    linkCopied: "Link Copied!",
    localMode: "Local Mode"
  },
  pt: {
    title: "Atari GO (9x9)",
    black: "Preto",
    white: "Branco",
    territory: "Território",
    caps: "Capturas",
    pointsRemaining: "Restante",
    turnSuffix: " - Sua vez",
    passBtn: "Passar",
    resetBtn: "Reiniciar",
    undoBtn: "Desfazer",
    rules: "<b>Pontos:</b> Total = Território + Capturas. Branco recebe 6.5 Komi.",
    killRules: "<b>Modo Kill:</b> O primeiro a capturar uma peça vence instantaneamente!",
    modalTitle: "Reiniciar?",
    modalBody: "Limpar tabuleiro e pontos? Não pode ser desfeito.",
    modalCancel: "Cancelar",
    modalConfirm: "Confirmar",
    suicideMsg: "Jogada suicida bloqueada!",
    koMsg: "Regra Ko: Repetição bloqueada.",
    gameOver: "Fim! {winner} vence por {b} a {w}",
    killWin: "Kill! {winner} capturou uma peça e venceu!",
    passedMsg: "{player} passou.",
    resetNotify: "Reiniciado",
    undoNotify: "Desfeito",
    modeClassic: "Go Clássico",
    modeKill: "Modo Kill",
    playOnline: "Jogar Online",
    copyLink: "Copiar Link",
    onlineAs: "Jogando como:",
    linkCopied: "Link Copiado!",
    localMode: "Modo Local"
  }
};

const SIZE = 9;
const KOMI = 6.5;

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
  const [user, setUser] = useState(null);
  const [board, setBoard] = useState(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [captures, setCaptures] = useState({ 1: 0, 2: 0 });
  const [lastBoardState, setLastBoardState] = useState(null);
  const [history, setHistory] = useState([]); 
  const [passCount, setPassCount] = useState(0);
  const [lang, setLang] = useState('en');
  const [gameMode, setGameMode] = useState('classic');
  const [message, setMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [playerRole, setPlayerRole] = useState(null); // 1 for Black (Host), 2 for White (Guest)
  const [isCopied, setIsCopied] = useState(false);

  const t = i18n[lang];

  // --- (1) AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- (2) MULTIPLAYER SYNC ---
  useEffect(() => {
    if (!user || !roomId) return;

    // Follow Rule 1: Strict Paths
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Only update if the change came from the other player
        if (data.lastMoveBy !== user.uid) {
          setBoard(JSON.parse(data.board));
          setCurrentPlayer(data.currentPlayer);
          setCaptures(data.captures);
          setIsGameOver(data.isGameOver);
          setGameMode(data.gameMode);
          setPassCount(data.passCount);
          if (data.message && data.lastMoveBy) {
            setMessage(data.message);
            setTimeout(() => setMessage(''), 3000);
          }
        }
      }
    }, (error) => console.error("Sync error:", error));

    return () => unsubscribe();
  }, [user, roomId]);

  // --- (3) URL & SEO PARSING ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rId = urlParams.get('room');
    if (rId) {
      setRoomId(rId);
      setPlayerRole(2); // If you follow a link, you are the guest (White)
    }

    const siteUrl = "https://atari-go.vercel.app/";
    document.title = `Atari GO - Play Online`;
    let canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = siteUrl;
    if (!canonical.parentNode) document.head.appendChild(canonical);
  }, []);

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
    let blackTerritory = 0, whiteTerritory = 0, emptyCount = 0;
    const visited = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0 && !visited.has(`${r},${c}`)) {
          emptyCount++;
          const area = [], queue = [{ r, c }], borders = new Set();
          visited.add(`${r},${c}`);
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
                } else if (board[n.r][n.c] !== 0) borders.add(board[n.r][n.c]);
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

  const syncToCloud = async (newBoard, nextPlayer, newCaptures, gameOver, newPassCount, customMessage = "") => {
    if (!roomId || !user) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    await updateDoc(roomRef, {
      board: JSON.stringify(newBoard),
      currentPlayer: nextPlayer,
      captures: newCaptures,
      isGameOver: gameOver,
      passCount: newPassCount,
      gameMode: gameMode,
      lastMoveBy: user.uid,
      message: customMessage,
      updatedAt: Date.now()
    });
  };

  const showFlashMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleMove = (r, c) => {
    if (board[r][c] !== 0 || isGameOver) return;
    if (playerRole && currentPlayer !== playerRole) return; 

    const testBoard = board.map(row => [...row]);
    testBoard[r][c] = currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;
    
    const captured = findCaptures(testBoard, opponent);
    captured.forEach(pos => testBoard[pos.r][pos.c] = 0);

    if (captured.length === 0 && findGroupAndLiberties(testBoard, r, c).liberties.length === 0) {
      showFlashMessage(t.suicideMsg);
      return;
    }

    if (JSON.stringify(testBoard) === lastBoardState) {
      showFlashMessage(t.koMsg);
      return;
    }

    setHistory(prev => [...prev, { board: board.map(row => [...row]), currentPlayer, captures: { ...captures }, lastBoardState }]);
    setLastBoardState(JSON.stringify(board));
    
    const newBoard = testBoard;
    const newCaptures = { ...captures, [currentPlayer]: captures[currentPlayer] + captured.length };
    let gameOver = isGameOver;
    let winMsg = "";

    if (gameMode === 'kill' && captured.length > 0) {
      gameOver = true;
      winMsg = t.killWin.replace('{winner}', currentPlayer === 1 ? t.black : t.white);
      showFlashMessage(winMsg);
    }

    setBoard(newBoard);
    setCaptures(newCaptures);
    setIsGameOver(gameOver);
    setPassCount(0);
    setCurrentPlayer(opponent);

    if (roomId) syncToCloud(newBoard, opponent, newCaptures, gameOver, 0, winMsg);
  };

  const undoMove = () => {
    if (history.length === 0 || isGameOver || !!roomId) return; 
    const last = history[history.length - 1];
    setBoard(last.board);
    setCurrentPlayer(last.currentPlayer);
    setCaptures(last.captures);
    setLastBoardState(last.lastBoardState);
    setHistory(prev => prev.slice(0, -1));
    showFlashMessage(t.undoNotify);
  };

  const handlePass = () => {
    if (isGameOver) return;
    if (playerRole && currentPlayer !== playerRole) return;

    setHistory(prev => [...prev, { board: board.map(row => [...row]), currentPlayer, captures: { ...captures }, lastBoardState }]);
    const nextPass = passCount + 1;
    let gameOver = isGameOver;
    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    let passMsg = "";

    if (nextPass >= 2) {
      gameOver = true;
      const b = scoreData.blackTerritory + captures[1];
      const w = scoreData.whiteTerritory + captures[2] + KOMI;
      const winner = b > w ? t.black : t.white;
      passMsg = t.gameOver.replace('{winner}', winner).replace('{b}', b.toFixed(1)).replace('{w}', w.toFixed(1));
    } else {
      passMsg = t.passedMsg.replace('{player}', currentPlayer === 1 ? t.black : t.white);
    }
    
    showFlashMessage(passMsg);
    setPassCount(nextPass);
    setIsGameOver(gameOver);
    setCurrentPlayer(nextPlayer);

    if (roomId) syncToCloud(board, nextPlayer, captures, gameOver, nextPass, passMsg);
  };

  const startOnlineRoom = async () => {
    if (!user) return;
    const newRoomId = Math.random().toString(36).substring(2, 9);
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId);
    await setDoc(roomRef, {
      board: JSON.stringify(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0))),
      currentPlayer: 1,
      captures: { 1: 0, 2: 0 },
      isGameOver: false,
      gameMode: gameMode,
      passCount: 0,
      lastMoveBy: user.uid,
      createdAt: Date.now()
    });
    setRoomId(newRoomId);
    setPlayerRole(1); 
    resetGame();
  };

  const resetGame = () => {
    if (roomId && playerRole !== 1) return; 
    setBoard(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
    setCurrentPlayer(1);
    setCaptures({ 1: 0, 2: 0 });
    setHistory([]);
    setPassCount(0);
    setIsGameOver(false);
    setShowResetModal(false);
    showFlashMessage(t.resetNotify);
    if (roomId) syncToCloud(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)), 1, { 1: 0, 2: 0 }, false, 0, t.resetNotify);
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    const textField = document.createElement('textarea');
    textField.innerText = link;
    document.body.appendChild(textField);
    textField.select();
    document.execCommand('copy');
    textField.remove();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isHoshi = (r, c) => [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]].some(p => p[0] === r && p[1] === c);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 font-sans p-2 sm:p-4 pb-20 sm:pt-4">
      
      <div className="w-full max-w-xl flex flex-col gap-3 mb-4 px-2">
        <div className="flex justify-between items-center">
            <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {['classic', 'kill'].map(m => (
                    <button 
                    key={m}
                    onClick={() => { if(!roomId) { setGameMode(m); resetGame(); } }}
                    disabled={!!roomId}
                    className={`px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors ${gameMode === m ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50 text-gray-600'} disabled:opacity-50`}
                    >
                    {m === 'classic' ? <Layout size={12} /> : <Swords size={12} />}
                    {m === 'classic' ? t.modeClassic : t.modeKill}
                    </button>
                ))}
            </div>
            
            <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {['en', 'pt'].map(l => (
                    <button 
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${lang === l ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                    >
                    {l.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
            {!roomId ? (
                <button 
                    onClick={startOnlineRoom}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all shadow-md active:scale-95"
                >
                    <Globe size={14} /> {t.playOnline}
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={copyRoomLink}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                        {isCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {isCopied ? t.linkCopied : t.copyLink}
                    </button>
                    <button 
                        onClick={() => { setRoomId(null); setPlayerRole(null); resetGame(); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300 transition-all"
                    >
                        {t.localMode}
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl flex flex-col items-center p-3 sm:p-6 border border-gray-200">
        <Logo />
        
        {roomId && (
            <div className="mb-4 flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] text-indigo-700 font-bold">
                <User size={10} />
                <span>{t.onlineAs} {playerRole === 1 ? t.black : t.white}</span>
                <span className="opacity-30">|</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Online</span>
            </div>
        )}

        <div className={`grid grid-cols-3 w-full mb-4 px-2 py-3 rounded-xl border border-gray-200 gap-1 transition-colors ${gameMode === 'kill' ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full bg-black shadow-sm ${currentPlayer === 1 && !isGameOver ? 'ring-2 ring-blue-400' : ''}`}></div>
              <span className="font-bold text-[10px] sm:text-xs truncate">{t.black}</span>
            </div>
            {gameMode === 'classic' && <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.territory}: {scoreData.blackTerritory}</p>}
            <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.caps}: {captures[1]}</p>
            <p className="text-sm sm:text-base font-black text-black">
                {gameMode === 'classic' ? (scoreData.blackTerritory + captures[1]).toFixed(1) : captures[1]}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center border-x border-gray-200 text-center">
            <div className={`text-[8px] font-black uppercase tracking-tighter mb-0.5 truncate w-full ${isGameOver ? 'text-green-600' : 'text-blue-600'}`}>
              {isGameOver ? 'FINISH' : `${currentPlayer === 1 ? t.black : t.white}${t.turnSuffix}`}
            </div>
            {gameMode === 'classic' && (
              <div className="text-[7px] text-gray-400 font-bold uppercase whitespace-nowrap">
                {scoreData.emptyCount} {t.pointsRemaining}
              </div>
            )}
            {gameMode === 'kill' && (
               <div className="text-[7px] text-red-500 font-bold uppercase flex items-center gap-1">
                 <Zap size={8} /> FIRST KILL WINS
               </div>
            )}
          </div>

          <div className="flex flex-col items-end text-right min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="font-bold text-[10px] sm:text-xs truncate">{t.white}</span>
              <div className={`w-2.5 h-2.5 rounded-full bg-white border border-gray-300 shadow-sm ${currentPlayer === 2 && !isGameOver ? 'ring-2 ring-blue-400' : ''}`}></div>
            </div>
            {gameMode === 'classic' && <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.territory}: {scoreData.whiteTerritory}</p>}
            <p className="text-[8px] sm:text-[9px] text-gray-500 whitespace-nowrap">{t.caps}: {captures[2]}</p>
            <p className="text-sm sm:text-base font-black text-gray-700">
                {gameMode === 'classic' ? (scoreData.whiteTerritory + captures[2] + KOMI).toFixed(1) : captures[2]}
            </p>
          </div>
        </div>

        <div className={`relative p-2 sm:p-4 rounded-xl shadow-inner mb-4 select-none touch-none border-4 transition-colors ${gameMode === 'kill' ? 'bg-[#c15b5b] border-[#a04a4a]' : 'bg-[#dbb06d] border-[#c19a5b]'}`}>
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")'}}></div>
            <div className="relative z-10">
                <div className="grid grid-cols-8 grid-rows-8 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] border border-black border-opacity-70">
                    {Array(64).fill(0).map((_, i) => <div key={i} className="border-[0.5px] border-black border-opacity-30 box-border"></div>)}
                </div>
                <div className="absolute top-0 left-0 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px]">
                    {board.map((row, r) => row.map((cell, c) => (
                        <div 
                            key={`${r}-${c}`}
                            onClick={() => handleMove(r, c)}
                            className={`absolute flex items-center justify-center ${isGameOver ? 'cursor-default' : 'cursor-pointer'}`}
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
                            {cell === 0 && !isGameOver && (!playerRole || currentPlayer === playerRole) && (
                                <div className={`w-4/5 h-4/5 rounded-full opacity-0 hover:opacity-30 transition-opacity ${currentPlayer === 1 ? 'bg-black' : 'bg-white border'}`}></div>
                            )}
                            {cell !== 0 && (
                                <div className={`w-[90%] h-[90%] rounded-full shadow-md animate-in fade-in zoom-in duration-200 ${cell === 1 ? 'bg-gradient-to-br from-gray-700 to-black' : 'bg-gradient-to-br from-white to-gray-200 border border-gray-300'}`}></div>
                            )}
                        </div>
                    )))}
                </div>
            </div>
        </div>

        <div className="h-6 mb-2 flex items-center justify-center">
            {message && (
               <div className={`px-3 py-0.5 rounded-full text-[9px] font-bold shadow-sm animate-pulse text-white ${isGameOver ? 'bg-green-600' : 'bg-blue-600'}`}>
                 {message}
               </div>
            )}
        </div>

        <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
            <button 
                onClick={undoMove} 
                disabled={history.length === 0 || isGameOver || !!roomId} 
                className="flex flex-col items-center justify-center py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-500 disabled:opacity-20 active:scale-95 transition-all shadow-sm"
            >
                <Undo2 size={14} className="text-gray-600" /><span className="text-[9px] font-black mt-0.5 text-gray-500 uppercase">{t.undoBtn}</span>
            </button>
            <button 
                onClick={handlePass} 
                disabled={isGameOver || (playerRole && currentPlayer !== playerRole)} 
                className="flex flex-col items-center justify-center py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-500 disabled:opacity-20 active:scale-95 transition-all shadow-sm"
            >
                <ChevronRight size={14} className="text-gray-600" /><span className="text-[9px] font-black mt-0.5 text-gray-500 uppercase">{t.passBtn}</span>
            </button>
            <button 
                onClick={() => setShowResetModal(true)} 
                disabled={roomId && playerRole !== 1}
                className="flex flex-col items-center justify-center py-2 bg-red-50 border border-red-100 rounded-xl text-red-600 disabled:opacity-20 active:scale-95 transition-all shadow-sm"
            >
                <RotateCcw size={14} /><span className="text-[9px] font-black mt-0.5 uppercase">{t.resetBtn}</span>
            </button>
        </div>

        <div className="w-full mt-6 pt-4 border-t border-gray-100 flex flex-col items-center">
            <div className="text-center text-[8px] text-gray-400 mb-4 leading-tight max-w-[200px] sm:max-w-none" dangerouslySetInnerHTML={{ __html: gameMode === 'classic' ? t.rules : t.killRules }}></div>
            
            <div className="w-full py-3 bg-gray-50 rounded-xl flex flex-col items-center gap-1 border border-gray-200 shadow-sm">
                <p className="text-[8px] text-gray-400 uppercase tracking-widest font-black flex items-center gap-1">
                    <Trophy size={8} className="text-yellow-600" /> CREATED BY <span className="text-gray-700 font-bold">OG</span>
                </p>
                <div className="flex flex-col items-center">
                    <p className="text-[7px] text-gray-300 font-bold mb-1 italic opacity-50">UID: {user?.uid?.substring(0, 8)}...</p>
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
      </div>

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