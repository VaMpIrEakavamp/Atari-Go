import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Instagram, RotateCcw, ChevronRight, Undo2, Trophy, 
  Swords, Zap, Layout, Globe, Copy, User, CheckCircle2, 
  LogIn, LogOut, Mail, Lock, ShieldCheck, AlertCircle, XCircle, Award
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, updateProfile,
  signInAnonymously, signInWithCustomToken
} from 'firebase/auth';
import { getFirestore, doc, onSnapshot, updateDoc, setDoc, getDoc, collection, increment, deleteDoc } from 'firebase/firestore';

/**
 * --- SECURE CONFIGURATION LOADER ---
 */
const getFirebaseConfig = () => {
  const globalEnv = typeof process !== 'undefined' ? process.env : {};
  let viteEnv = {};
  try { viteEnv = import.meta.env; } catch (e) {}

  const config = {
    apiKey: viteEnv?.VITE_FIREBASE_API_KEY || globalEnv?.VITE_FIREBASE_API_KEY || "",
    authDomain: viteEnv?.VITE_FIREBASE_AUTH_DOMAIN || globalEnv?.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: viteEnv?.VITE_FIREBASE_PROJECT_ID || globalEnv?.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: viteEnv?.VITE_FIREBASE_STORAGE_BUCKET || globalEnv?.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: viteEnv?.VITE_FIREBASE_MESSAGING_SENDER_ID || globalEnv?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: viteEnv?.VITE_FIREBASE_APP_ID || globalEnv?.VITE_FIREBASE_APP_ID || "",
    measurementId: viteEnv?.VITE_FIREBASE_MEASUREMENT_ID || globalEnv?.VITE_FIREBASE_MEASUREMENT_ID || ""
  };

  if (!config.apiKey && typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    } catch (e) {
      console.error("Config Error: __firebase_config parse failed.", e);
    }
  }

  return config;
};

const firebaseConfig = getFirebaseConfig();
let app, auth, db;

if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase Init Failed:", error);
  }
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const SIZE = 9;
const KOMI = 6.5;

const getPlayerName = (u) => {
  if (!u) return "Unknown";
  if (u.displayName) return u.displayName;
  if (u.email) return u.email.split('@')[0];
  return `Guest_${u.uid.substring(0, 4)}`;
};

// --- NATIVE SOUND ENGINE ---
// Generates professional sound effects without needing external MP3 files
const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'place') {
      // Deep wooden "thock"
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'capture') {
      // Bright "pop/ding"
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'win') {
      // Happy victory chord
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(500, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch (e) {
    console.error("Audio error:", e); // Fails silently if browser blocks auto-play
  }
};

const i18n = {
  en: {
    title: "Atari GO (9x9)", black: "Black", white: "White", territory: "Territory", caps: "Captures",
    pointsRemaining: "Remaining", turnSuffix: "'s Turn", passBtn: "Pass", resetBtn: "Reset", undoBtn: "Undo",
    rules: "<b>Scoring:</b> Total = Territory + Captures. White gets 6.5 Komi.",
    killRules: "<b>Kill Mode:</b> First player to capture a stone wins instantly!",
    modalTitle: "Reset Game?", modalBody: "Clear board and scores? This cannot be undone.",
    modalCancel: "Cancel", modalConfirm: "Reset", suicideMsg: "Suicide move blocked!",
    koMsg: "Ko rule: Position repeat blocked.", gameOver: "Game Over! {winner} wins {b} to {w}",
    killWin: "Kill! {winner} captured a stone and wins!", passedMsg: "{player} passed.",
    resetNotify: "Game Reset", undoNotify: "Undone", modeClassic: "Classic Go", modeKill: "Kill Mode",
    playOnline: "Play Online", copyLink: "Copy Link", onlineAs: "Playing as:", linkCopied: "Link Copied!",
    localMode: "Local Mode", loginTitle: "Enter the Dojo", email: "Email Address", password: "Password",
    username: "Username", signIn: "Sign In", signUp: "Create Account", noAccount: "New player? Register",
    hasAccount: "Already a master? Login", authError: "Authentication Failed. Please check your credentials.",
    waiting: "Waiting...", gameOverTitle: "Match Finished!", rematch: "Play Again", exitOnline: "Exit Mode",
    leaderboard: "Leaderboard", rank: "Rank", wins: "Wins", total: "Total", classic: "Classic", kill: "Kill",
    mustLoginToJoin: "Please log in or register to join the match!",
    idleTitle: "Are you still playing?", idleBody: "The room will automatically close in 1 minute if there is no response.",
    yes: "Yes", no: "No"
  },
  pt: {
    title: "Atari GO (9x9)", black: "Preto", white: "Branco", territory: "Território", caps: "Capturas",
    pointsRemaining: "Restante", turnSuffix: " - Sua vez", passBtn: "Passar", resetBtn: "Reiniciar", undoBtn: "Desfazer",
    rules: "<b>Pontos:</b> Total = Território + Capturas. Branco recebe 6.5 Komi.",
    killRules: "<b>Modo Kill:</b> O primeiro a capturar uma peça vence instantaneamente!",
    modalTitle: "Reiniciar?", modalBody: "Limpar tabuleiro e pontos? Não pode ser desfeito.",
    modalCancel: "Cancelar", modalConfirm: "Confirmar", suicideMsg: "Jogada suicida bloqueada!",
    koMsg: "Regra Ko: Repetição bloqueada.", gameOver: "Fim! {winner} vence por {b} a {w}",
    killWin: "Kill! {winner} capturou uma peça e venceu!", passedMsg: "{player} passou.",
    resetNotify: "Reiniciado", undoNotify: "Desfeito", modeClassic: "Go Clássico", modeKill: "Modo Kill",
    playOnline: "Jogar Online", copyLink: "Copiar Link", onlineAs: "Jogando como:", linkCopied: "Link Copiado!",
    localMode: "Modo Local", loginTitle: "Entrar no Dojo", email: "E-mail", password: "Senha",
    username: "Usuário", signIn: "Entrar", signUp: "Criar Conta", noAccount: "Novo jogador? Registre-se",
    hasAccount: "Já é um mestre? Login", authError: "Falha na autenticação.",
    waiting: "Aguardando...", gameOverTitle: "Fim de Jogo!", rematch: "Jogar Novamente", exitOnline: "Sair do Modo",
    leaderboard: "Placar", rank: "Posição", wins: "Vitórias", total: "Total", classic: "Clássico", kill: "Kill",
    mustLoginToJoin: "Faça login ou registre-se para entrar na partida!",
    idleTitle: "Ainda está jogando?", idleBody: "A sala será fechada em 1 minuto se não houver resposta.",
    yes: "Sim", no: "Não"
  }
};

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

// --- CONFETTI COMPONENT ---
const Confetti = () => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[400]">
      {[...Array(60)].map((_, i) => (
        <div 
          key={i} 
          className={`absolute w-3 h-3 rounded-sm opacity-80 ${colors[i % colors.length]}`} 
          style={{
            left: `${Math.random() * 100}%`,
            top: `-5%`,
            animation: `fall ${2 + Math.random() * 3}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [authForm, setAuthForm] = useState({ email: '', password: '', username: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [dbError, setDbError] = useState('');

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
  const [playerRole, setPlayerRole] = useState(null); 
  const [isCopied, setIsCopied] = useState(false);
  
  // --- VISUAL HIGHLIGHT STATES ---
  const [winningMove, setWinningMove] = useState(null);
  const [capturedStones, setCapturedStones] = useState([]);
  const [lastMove, setLastMove] = useState(null); // Tracks the subtle glow

  const [playerNames, setPlayerNames] = useState({ 1: '', 2: '' });
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // --- LEADERBOARD STATE ---
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardSort, setLeaderboardSort] = useState('total');

  // --- IDLE SYSTEM STATE ---
  const [isAloneInRoom, setIsAloneInRoom] = useState(false);
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const [idleResetCounter, setIdleResetCounter] = useState(0);
  const idleTimerRef = useRef(null);
  const promptTimerRef = useRef(null);
  const isInitialLoad = useRef(true);

  const t = i18n[lang];

  const showFlashMessage = useCallback((msg) => {
    if (!msg) return;
    setMessage(msg);
  }, []);

  useEffect(() => {
    if (message && !isGameOver) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message, isGameOver]);

  // --- AUTH LISTENER ---
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Anonymous auth disabled:", e);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsAuthModalOpen(false);
        setAuthErrorMsg('');
      }
    });
    return () => unsubscribe();
  }, []);

  // --- URL JOIN LISTENER ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');
    
    if (urlRoomId && !roomId && user && db) {
      if (user.isAnonymous) {
        setAuthErrorMsg(t.mustLoginToJoin);
        setIsAuthModalOpen(true);
        return;
      }

      const joinExistingRoom = async () => {
        try {
          const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', urlRoomId);
          const snap = await getDoc(roomRef);
          
          if (snap.exists()) {
            const data = snap.data();
            let role = null;
            const name = getPlayerName(user);
            
            if (data.player1Id === user.uid) {
              role = 1;
            } else if (data.player2Id === user.uid) {
              role = 2;
            } else if (!data.player1Id) {
              role = 1;
              await updateDoc(roomRef, { player1Id: user.uid, player1Name: name });
            } else if (!data.player2Id) {
              role = 2;
              await updateDoc(roomRef, { player2Id: user.uid, player2Name: name });
            }
            
            setRoomId(urlRoomId);
            setPlayerRole(role);
            isInitialLoad.current = true; // Reset sound blocker for new room
          }
        } catch (error) {
          console.error("Join Room Error:", error);
          setDbError("Unable to join room. Please verify your Firestore Database Security Rules.");
        }
      };
      joinExistingRoom();
    }
  }, [user, roomId, db, t.mustLoginToJoin]);

  // --- SAFE LOCAL RESET HELPER ---
  const resetToLocal = useCallback((customMessage = '') => {
    setRoomId(null);
    setPlayerRole(null);
    window.history.replaceState({}, '', window.location.pathname);
    
    setBoard(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0)));
    setCurrentPlayer(1);
    setCaptures({ 1: 0, 2: 0 });
    setHistory([]);
    setPassCount(0);
    setIsGameOver(false);
    setWinningMove(null);
    setCapturedStones([]);
    setLastMove(null);
    setMessage(typeof customMessage === 'string' ? customMessage : '');
  }, []);

  // --- CLEAN EXIT ONLINE & DATABASE CLEANUP ---
  const handleExitOnline = useCallback(async (msg = '') => {
    if (roomId && user && db && playerRole) {
      try {
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
        const snap = await getDoc(roomRef);
        
        if (snap.exists()) {
          const data = snap.data();
          const isPlayer1 = playerRole === 1;
          const otherPlayerId = isPlayer1 ? data.player2Id : data.player1Id;

          if (!otherPlayerId) {
            await deleteDoc(roomRef);
          } else {
            await updateDoc(roomRef, {
              [isPlayer1 ? 'player1Id' : 'player2Id']: null,
              [isPlayer1 ? 'player1Name' : 'player2Name']: null,
              message: `${getPlayerName(user)} left the match.`
            });
          }
        }
      } catch (e) {
        console.error("Error cleaning up room:", e);
      }
    }
    
    resetToLocal(typeof msg === 'string' ? msg : '');
  }, [roomId, user, db, playerRole, resetToLocal]);

  // --- FIRESTORE SYNC & SOUND PLAYBACK ---
  useEffect(() => {
    if (!user || !roomId || !db) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        setPlayerNames({
          1: data.player1Name || t.waiting,
          2: data.player2Name || t.waiting
        });

        const alone = (data.player1Id === user.uid && !data.player2Id) || (data.player2Id === user.uid && !data.player1Id);
        setIsAloneInRoom(alone);

        if (data.lastMoveBy !== user.uid) {
          
          // Network Sound Feedback Logic
          if (isInitialLoad.current) {
            isInitialLoad.current = false; // Block sound on initial game load
          } else {
            // Determine which sound to play based on the opponent's move
            if (data.isGameOver && !isGameOver) {
              playSound('win');
            } else if (data.capturedStones && JSON.parse(data.capturedStones).length > 0) {
              playSound('capture');
            } else if (data.lastMove) {
              playSound('place');
            }
          }

          setBoard(JSON.parse(data.board));
          setCurrentPlayer(data.currentPlayer);
          setCaptures(data.captures);
          setIsGameOver(data.isGameOver);
          setGameMode(data.gameMode);
          setPassCount(data.passCount);
          setLastMove(data.lastMove ? JSON.parse(data.lastMove) : null);
          setWinningMove(data.winningMove ? JSON.parse(data.winningMove) : null);
          setCapturedStones(data.capturedStones ? JSON.parse(data.capturedStones) : []);
          
          if (data.message) showFlashMessage(data.message);
        }
      } else {
        resetToLocal("The room was closed.");
      }
    }, (error) => {
      console.error("Sync error:", error);
      setDbError("Lost connection to the room. Database read permission denied.");
    });
    return () => unsubscribe();
  }, [user, roomId, showFlashMessage, t.waiting, resetToLocal, isGameOver]);

  // --- IDLE TIMER SYSTEM ---
  useEffect(() => {
    const idleTimeoutMs = 5 * 60 * 1000; 
    const promptTimeoutMs = 60 * 1000;   

    if (isAloneInRoom && roomId) {
      idleTimerRef.current = setTimeout(() => {
        setShowIdlePrompt(true);
        promptTimerRef.current = setTimeout(() => {
          setShowIdlePrompt(false);
          handleExitOnline("Room closed due to inactivity.");
        }, promptTimeoutMs);
      }, idleTimeoutMs);
    } else {
      clearTimeout(idleTimerRef.current);
      clearTimeout(promptTimerRef.current);
      setShowIdlePrompt(false);
    }

    return () => {
      clearTimeout(idleTimerRef.current);
      clearTimeout(promptTimerRef.current);
    };
  }, [isAloneInRoom, roomId, handleExitOnline, idleResetCounter]);

  const handleStillPlaying = () => {
    setShowIdlePrompt(false);
    setIdleResetCounter(c => c + 1); 
  };

  // --- LEADERBOARD SYNC ---
  useEffect(() => {
    if (!showLeaderboard || !db) return;
    const lbCol = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    
    const unsub = onSnapshot(lbCol, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setLeaderboardData(data);
    }, (error) => {
      console.error("Leaderboard fetch error:", error);
      setDbError("Unable to fetch leaderboard. Permission denied.");
    });
    
    return () => unsub();
  }, [showLeaderboard, db]);

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
      if (leaderboardSort === 'classic') return (b.classicWins || 0) - (a.classicWins || 0);
      if (leaderboardSort === 'kill') return (b.killWins || 0) - (a.killWins || 0);
      return (b.totalWins || 0) - (a.totalWins || 0);
    });
  }, [leaderboardData, leaderboardSort]);

  const updateLeaderboard = useCallback(async (mode) => {
    if (!user || !db) return;
    const lbRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid);
    try {
      const snap = await getDoc(lbRef);
      if (snap.exists()) {
        await updateDoc(lbRef, {
          [mode + 'Wins']: increment(1),
          totalWins: increment(1),
          displayName: getPlayerName(user)
        });
      } else {
        await setDoc(lbRef, {
          displayName: getPlayerName(user),
          classicWins: mode === 'classic' ? 1 : 0,
          killWins: mode === 'kill' ? 1 : 0,
          totalWins: 1
        });
      }
    } catch (e) {
      console.error("Failed to update leaderboard rank:", e);
    }
  }, [user, db]);

  const syncToCloud = useCallback(async (newBoard, nextPlayer, newCaptures, gameOver, newPassCount, customMessage = "", winMove = null, capStones = [], mvObj = null) => {
    if (!roomId || !user || !db) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    try {
      await updateDoc(roomRef, {
        board: JSON.stringify(newBoard),
        currentPlayer: nextPlayer,
        captures: newCaptures,
        isGameOver: gameOver,
        passCount: newPassCount,
        gameMode,
        lastMoveBy: user.uid,
        message: customMessage,
        winningMove: winMove ? JSON.stringify(winMove) : null,
        capturedStones: capStones.length ? JSON.stringify(capStones) : null,
        lastMove: mvObj ? JSON.stringify(mvObj) : null,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error("Cloud sync failed", e);
      setDbError("Move not saved! Database write permission denied.");
    }
  }, [roomId, user, gameMode]);

  // --- GAME LOGIC FUNCTIONS ---
  const findGroupAndLiberties = useCallback((tempBoard, r, c) => {
    const color = tempBoard[r][c];
    if (color === 0) return { group: [], liberties: [] };
    const queue = [{ r, c }], visited = new Set([`${r},${c}`]), group = [], liberties = new Set();
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
    const captured = [], processed = new Set();
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

  const handleMove = useCallback((r, c) => {
    if (board[r][c] !== 0 || isGameOver) return;
    if (playerRole && currentPlayer !== playerRole) return; 
    const testBoard = board.map(row => [...row]);
    testBoard[r][c] = currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;
    const captured = findCaptures(testBoard, opponent);
    captured.forEach(pos => testBoard[pos.r][pos.c] = 0);
    
    if (captured.length === 0 && findGroupAndLiberties(testBoard, r, c).liberties.length === 0) {
      showFlashMessage(t.suicideMsg);
      setTimeout(() => setMessage(''), 3000); 
      return;
    }
    if (JSON.stringify(testBoard) === lastBoardState) {
      showFlashMessage(t.koMsg);
      setTimeout(() => setMessage(''), 3000); 
      return;
    }
    
    // Valid move execution
    setHistory(prev => [...prev, { board: board.map(row => [...row]), currentPlayer, captures: { ...captures }, lastBoardState }]);
    setLastBoardState(JSON.stringify(board));
    const newBoard = testBoard;
    const newCaptures = { ...captures, [currentPlayer]: captures[currentPlayer] + captured.length };
    const currentMoveObj = { r, c };
    
    let gameOver = isGameOver;
    let winMsg = "";
    let finalWinningMove = null;
    let finalCapturedStones = [];

    if (gameMode === 'kill' && captured.length > 0) {
      gameOver = true;
      finalWinningMove = { r, c };
      finalCapturedStones = captured;
      
      const winnerName = playerNames[currentPlayer] || (currentPlayer === 1 ? t.black : t.white);
      winMsg = t.killWin.replace('{winner}', winnerName);
      showFlashMessage(winMsg);
      playSound('win');

      if (roomId && playerRole === currentPlayer) {
        updateLeaderboard('kill');
      }
    } else if (captured.length > 0) {
      playSound('capture');
    } else {
      playSound('place');
    }
    
    setBoard(newBoard);
    setCaptures(newCaptures);
    setIsGameOver(gameOver);
    setWinningMove(finalWinningMove);
    setCapturedStones(finalCapturedStones);
    setLastMove(currentMoveObj);
    setPassCount(0);
    setCurrentPlayer(opponent);
    
    if (roomId) syncToCloud(newBoard, opponent, newCaptures, gameOver, 0, winMsg, finalWinningMove, finalCapturedStones, currentMoveObj);
  }, [board, isGameOver, playerRole, currentPlayer, findCaptures, findGroupAndLiberties, lastBoardState, captures, gameMode, t, roomId, syncToCloud, showFlashMessage, playerNames, updateLeaderboard]);

  const handlePass = useCallback(() => {
    if (isGameOver || (playerRole && currentPlayer !== playerRole)) return;
    setHistory(prev => [...prev, { board: board.map(row => [...row]), currentPlayer, captures: { ...captures }, lastBoardState }]);
    const nextPass = passCount + 1;
    let gameOver = isGameOver;
    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    let passMsg = "";
    
    if (nextPass >= 2) {
      gameOver = true;
      const b = scoreData.blackTerritory + captures[1];
      const w = scoreData.whiteTerritory + captures[2] + KOMI;
      const winnerRole = b > w ? 1 : 2;
      const winner = b > w ? (playerNames[1] || t.black) : (playerNames[2] || t.white);
      passMsg = t.gameOver.replace('{winner}', winner).replace('{b}', b.toFixed(1)).replace('{w}', w.toFixed(1));
      playSound('win');

      if (roomId && playerRole === winnerRole) {
        updateLeaderboard('classic');
      }

    } else {
      const pName = playerNames[currentPlayer] || (currentPlayer === 1 ? t.black : t.white);
      passMsg = t.passedMsg.replace('{player}', pName);
      playSound('place');
    }
    
    showFlashMessage(passMsg);
    setPassCount(nextPass);
    setIsGameOver(gameOver);
    setCurrentPlayer(nextPlayer);
    setLastMove(null); // Clear highlight on pass
    if (roomId) syncToCloud(board, nextPlayer, captures, gameOver, nextPass, passMsg, null, [], null);
  }, [isGameOver, playerRole, currentPlayer, board, captures, lastBoardState, passCount, scoreData, t, roomId, syncToCloud, showFlashMessage, playerNames, updateLeaderboard]);

  const resetGame = useCallback(() => {
    if (roomId && !playerRole) return; 
    
    const emptyBoard = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
    setBoard(emptyBoard);
    setCurrentPlayer(1);
    setCaptures({ 1: 0, 2: 0 });
    setHistory([]);
    setPassCount(0);
    setIsGameOver(false);
    setWinningMove(null);
    setCapturedStones([]);
    setLastMove(null);
    setShowResetModal(false);
    showFlashMessage(t.resetNotify);
    setTimeout(() => setMessage(''), 3000);
    
    if (roomId) syncToCloud(emptyBoard, 1, { 1: 0, 2: 0 }, false, 0, "", null, [], null);
  }, [roomId, playerRole, t, showFlashMessage, syncToCloud]);

  const undoMove = useCallback(() => {
    if (history.length === 0 || isGameOver || !!roomId) return; 
    const last = history[history.length - 1];
    setBoard(last.board);
    setCurrentPlayer(last.currentPlayer);
    setCaptures(last.captures);
    setLastBoardState(last.lastBoardState);
    setHistory(prev => prev.slice(0, -1));
    setLastMove(null); // Clear highlight on undo
    showFlashMessage(t.undoNotify);
    setTimeout(() => setMessage(''), 3000);
  }, [history, isGameOver, roomId, t, showFlashMessage]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setAuthLoading(true);
    setAuthErrorMsg('');
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        await updateProfile(cred.user, { displayName: authForm.username });
        setUser({ ...cred.user, displayName: authForm.username }); 
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
      setIsAuthModalOpen(false); 
    } catch (err) {
      setAuthErrorMsg(t.authError);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = useCallback(async () => {
    if (auth) {
      await signOut(auth);
      await signInAnonymously(auth); 
    }
    handleExitOnline();
  }, [handleExitOnline]);

  const startOnlineRoom = async () => {
    setDbError(''); 
    if (!user) { setIsAuthModalOpen(true); return; }
    if (!db) { setDbError("Database is not connected."); return; }
    
    setIsCreatingRoom(true);
    try {
      const newRoomId = Math.random().toString(36).substring(2, 9);
      const hostIsBlack = Math.random() > 0.5; 
      const assignedRole = hostIsBlack ? 1 : 2;
      const name = getPlayerName(user);

      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId);
      
      await setDoc(roomRef, {
        board: JSON.stringify(Array(SIZE).fill(null).map(() => Array(SIZE).fill(0))),
        currentPlayer: 1, 
        captures: { 1: 0, 2: 0 }, 
        isGameOver: false,
        gameMode, 
        passCount: 0, 
        lastMoveBy: user.uid, 
        createdAt: Date.now(),
        player1Id: hostIsBlack ? user.uid : null,
        player2Id: !hostIsBlack ? user.uid : null,
        player1Name: hostIsBlack ? name : null,
        player2Name: !hostIsBlack ? name : null,
        winningMove: null,
        capturedStones: null,
        lastMove: null
      });
      
      isInitialLoad.current = true;
      setRoomId(newRoomId);
      setPlayerRole(assignedRole); 
      resetGame();
    } catch (error) {
      console.error("Room creation failed:", error);
      if (error.code === 'permission-denied') {
        setDbError("Permission Denied: Your Firestore rules are blocking writes. Please go to your Firebase Console -> Firestore -> Rules, and set them to allow read/write.");
      } else {
        setDbError(`Database Error: ${error.message}. Please ensure Firestore is initialized in your Firebase Console.`);
      }
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const copyRoomLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-black mb-2 uppercase tracking-tighter">Configuration Error</h1>
        <p className="text-gray-400 text-sm max-w-xs mb-6">
          You are missing required Firebase Environment Variables. Ensure both <b>VITE_FIREBASE_API_KEY</b> and <b>VITE_FIREBASE_PROJECT_ID</b> are set in your .env file!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 font-sans p-2 sm:p-4 pb-20 sm:pt-4 relative">
      {isGameOver && <Confetti />}

      <div className="w-full max-w-xl flex flex-col gap-3 mb-4 px-2 relative z-10">
        <div className="flex justify-between items-center">
            <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {['classic', 'kill'].map(m => (
                    <button key={m} onClick={() => { if(!roomId) { setGameMode(m); resetGame(); } }} disabled={!!roomId}
                      className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${gameMode === m ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50 text-gray-600'} disabled:opacity-50`}
                    >
                    {m === 'classic' ? t.modeClassic : t.modeKill}
                    </button>
                ))}
            </div>
            
            <div className="flex gap-2">
                <button onClick={() => setShowLeaderboard(true)} className="flex items-center justify-center px-2 py-1.5 bg-yellow-100 text-yellow-600 rounded-lg shadow-sm border border-yellow-200 hover:bg-yellow-200 active:scale-95 transition-all">
                    <Award size={14} className="mr-1" /> <span className="text-[10px] font-bold uppercase">{t.rank}</span>
                </button>
                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {['en', 'pt'].map(l => (
                        <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${lang === l ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
                          {l.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        
        {dbError && (
          <div className="w-full mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-600 text-[10px] font-bold shadow-sm">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1 leading-relaxed">{dbError}</span>
            <button onClick={() => setDbError('')} className="text-red-400 hover:text-red-700 shrink-0"><XCircle size={14} /></button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 w-full justify-between items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            {!roomId ? (
              <button onClick={startOnlineRoom} disabled={isCreatingRoom} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all disabled:opacity-50">
                <Globe size={14} className={isCreatingRoom ? "animate-spin" : ""} /> {isCreatingRoom ? "Connecting..." : t.playOnline}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={copyRoomLink} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all">
                  {isCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {isCopied ? t.linkCopied : t.copyLink}
                </button>
                <button onClick={handleExitOnline} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all">
                  {t.localMode}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user && !user.isAnonymous ? (
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <User size={14} className="text-indigo-600" />
                <span className="text-xs font-bold text-gray-700 truncate max-w-[100px]">{getPlayerName(user)}</span>
                <button onClick={handleSignOut} className="ml-1 text-gray-400 hover:text-red-500 transition-colors" title="Log Out">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-all">
                <LogIn size={14} /> {t.signIn}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl flex flex-col items-center p-3 sm:p-6 border border-gray-200 relative z-10">
        <Logo />
        {roomId && user && (
            <div className="mb-4 flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] text-indigo-700 font-bold">
                <User size={10} />
                <span>{getPlayerName(user)} ({playerRole === 1 ? t.black : t.white})</span>
                <span className="opacity-30">|</span>
                <span className="flex items-center gap-1 font-black"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> ONLINE</span>
            </div>
        )}
        
        <div className={`grid grid-cols-3 w-full mb-4 px-2 py-3 rounded-xl border border-gray-200 gap-1 transition-colors ${gameMode === 'kill' ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full bg-black shadow-sm ${currentPlayer === 1 && !isGameOver ? 'ring-2 ring-blue-400' : ''}`}></div>
              <span className="font-bold text-[10px] sm:text-xs truncate">{playerNames[1] || t.black}</span>
            </div>
            {gameMode === 'classic' && <p className="text-[8px] text-gray-500 truncate">{t.territory}: {scoreData.blackTerritory}</p>}
            <p className="text-[8px] text-gray-500 truncate">{t.caps}: {captures[1]}</p>
            <p className="text-sm sm:text-base font-black text-black">{(gameMode === 'classic' ? (scoreData.blackTerritory + captures[1]) : captures[1]).toFixed(1)}</p>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-gray-200 text-center">
            <div className={`text-[8px] font-black uppercase tracking-tighter mb-0.5 truncate w-full ${isGameOver ? 'text-green-600' : 'text-blue-600'}`}>
              {isGameOver ? 'FINISH' : `${playerNames[currentPlayer] || (currentPlayer === 1 ? t.black : t.white)}${t.turnSuffix}`}
            </div>
            <div className="text-[7px] text-gray-400 font-bold uppercase whitespace-nowrap">
              {gameMode === 'classic' ? `${scoreData.emptyCount} ${t.pointsRemaining}` : "FIRST KILL WINS"}
            </div>
          </div>
          <div className="flex flex-col items-end text-right min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="font-bold text-[10px] sm:text-xs truncate">{playerNames[2] || t.white}</span>
              <div className={`w-2.5 h-2.5 rounded-full bg-white border border-gray-300 shadow-sm ${currentPlayer === 2 && !isGameOver ? 'ring-2 ring-blue-400' : ''}`}></div>
            </div>
            {gameMode === 'classic' && <p className="text-[8px] text-gray-500 truncate">{t.territory}: {scoreData.whiteTerritory}</p>}
            <p className="text-[8px] text-gray-500 truncate">{t.caps}: {captures[2]}</p>
            <p className="text-sm sm:text-base font-black text-gray-700">{(gameMode === 'classic' ? (scoreData.whiteTerritory + captures[2] + KOMI) : captures[2]).toFixed(1)}</p>
          </div>
        </div>

        <div className={`relative p-2 sm:p-4 rounded-xl shadow-inner select-none touch-none border-4 transition-colors ${gameMode === 'kill' ? 'bg-[#c15b5b] border-[#a04a4a]' : 'bg-[#dbb06d] border-[#c19a5b]'}`}>
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")'}}></div>
            <div className="relative z-10">
                <div className="grid grid-cols-8 grid-rows-8 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] border border-black border-opacity-70">
                    {Array(64).fill(0).map((_, i) => <div key={i} className="border-[0.5px] border-black border-opacity-30 box-border"></div>)}
                </div>
                <div className="absolute top-0 left-0 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px]">
                    {board.map((row, r) => row.map((cell, c) => {
                        const isWinningMove = winningMove && winningMove.r === r && winningMove.c === c;
                        const isCaptured = capturedStones.some(stone => stone.r === r && stone.c === c);
                        const isLastMove = lastMove && lastMove.r === r && lastMove.c === c;

                        return (
                          <div key={`${r}-${c}`} onClick={() => handleMove(r, c)} className={`absolute flex items-center justify-center ${isGameOver ? 'cursor-default' : 'cursor-pointer'}`}
                              style={{ top: `${(r / (SIZE - 1)) * 100}%`, left: `${(c / (SIZE - 1)) * 100}%`, width: '11.11%', height: '11.11%', transform: 'translate(-50%, -50%)', zIndex: 20 }}>
                              
                              {/* Board Intersection Dots */}
                              {[[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]].some(p => p[0] === r && p[1] === c) && cell === 0 && <div className="absolute w-1 h-1 bg-black bg-opacity-60 rounded-full"></div>}
                              
                              {/* Hover Indicator */}
                              {cell === 0 && !isGameOver && (!playerRole || currentPlayer === playerRole) && <div className={`w-4/5 h-4/5 rounded-full opacity-0 hover:opacity-30 transition-opacity ${currentPlayer === 1 ? 'bg-black' : 'bg-white border'}`}></div>}
                              
                              {/* Actual Stones */}
                              {cell !== 0 && (
                                <div className={`w-[90%] h-[90%] rounded-full shadow-md animate-in fade-in zoom-in duration-200 
                                  ${cell === 1 ? 'bg-gradient-to-br from-gray-700 to-black' : 'bg-gradient-to-br from-white to-gray-200 border border-gray-300'} 
                                  ${isWinningMove ? 'ring-4 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,1)] scale-110 z-30' : 
                                    isLastMove ? 'ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse z-20' : ''}`}>
                                </div>
                              )}

                              {/* Target Marker for KILLED Stones */}
                              {isGameOver && isCaptured && (
                                <div className="absolute w-[90%] h-[90%] rounded-full bg-red-500/40 border-2 border-red-500 flex items-center justify-center z-20 animate-in zoom-in">
                                  <div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)]"></div>
                                </div>
                              )}
                          </div>
                        );
                    }))}
                </div>
            </div>
        </div>

        {/* --- DYNAMIC ACTION AREA --- */}
        <div className="w-full mt-4 h-[72px] flex items-center justify-center">
          {isGameOver ? (
             <div className="w-full h-full bg-white border border-yellow-300 rounded-xl px-4 py-2 shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-2 relative z-10">
               <div className="flex flex-col flex-1 truncate pr-2">
                 <div className="flex items-center gap-1.5 text-yellow-500 font-black tracking-tighter uppercase text-[10px]">
                   <Trophy size={14} /> {t.gameOverTitle}
                 </div>
                 <span className="text-xs font-bold text-gray-700 truncate">{message}</span>
               </div>
               <div className="flex gap-2 shrink-0">
                 <button onClick={handleExitOnline} className="px-3 py-2 bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-200 active:scale-95 transition-all">
                   {t.exitOnline}
                 </button>
                 <button onClick={resetGame} disabled={roomId && !playerRole} className="px-3 py-2 bg-green-500 text-white text-[10px] font-black uppercase rounded-lg shadow-md hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none">
                   {t.rematch}
                 </button>
               </div>
             </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 w-full max-w-sm h-full">
                <button onClick={undoMove} disabled={history.length === 0 || !!roomId} className="flex flex-col items-center justify-center py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-500 disabled:opacity-20 active:scale-95 transition-all shadow-sm"><Undo2 size={14} className="text-gray-600" /><span className="text-[9px] font-black mt-0.5 uppercase">{t.undoBtn}</span></button>
                <button onClick={handlePass} disabled={(playerRole && currentPlayer !== playerRole)} className="flex flex-col items-center justify-center py-2 bg-white border border-gray-200 rounded-xl hover:border-blue-500 disabled:opacity-20 active:scale-95 transition-all shadow-sm"><ChevronRight size={14} className="text-gray-600" /><span className="text-[9px] font-black mt-0.5 uppercase">{t.passBtn}</span></button>
                <button onClick={() => setShowResetModal(true)} disabled={roomId && !playerRole} className="flex flex-col items-center justify-center py-2 bg-red-50 border border-red-100 rounded-xl text-red-600 disabled:opacity-20 active:scale-95 transition-all shadow-sm"><RotateCcw size={14} /><span className="text-[9px] font-black mt-0.5 uppercase">{t.resetBtn}</span></button>
            </div>
          )}
        </div>
      </div>

      {/* --- STYLISH FOOTER --- */}
      <div className="mt-6 mb-4 flex flex-col items-center justify-center gap-2 relative z-10">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Created by OG</span>
          <a 
            href="https://www.instagram.com/0g_2k6?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-purple-500 hover:via-pink-500 hover:to-orange-500 hover:border-transparent transition-all duration-300 group"
            title="Follow OG on Instagram"
          >
            <Instagram size={14} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[11px] font-black tracking-wide">@0g_2k6</span>
          </a>
      </div>

      {/* --- IDLE PROMPT MODAL --- */}
      {showIdlePrompt && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center">
            <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-[280px] w-full animate-in zoom-in slide-in-from-bottom-2 duration-200">
                <h3 className="text-base font-black mb-1 text-gray-900">{t.idleTitle}</h3>
                <p className="text-gray-500 text-[10px] mb-6 leading-relaxed">{t.idleBody}</p>
                <div className="flex gap-3">
                    <button onClick={() => { setShowIdlePrompt(false); handleExitOnline("Room closed due to inactivity."); }} className="flex-1 py-2 text-[10px] text-gray-500 font-bold hover:bg-gray-50 bg-gray-100 rounded-lg">{t.no}</button>
                    <button onClick={handleStillPlaying} className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-lg shadow-lg active:scale-95 transition-all">{t.yes}</button>
                </div>
            </div>
        </div>
      )}

      {/* --- LEADERBOARD MODAL --- */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in duration-300 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-yellow-600 font-black text-xl uppercase tracking-tighter">
                <Trophy size={24} /> {t.leaderboard}
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="text-gray-400 hover:text-red-500 active:scale-90 transition-transform"><XCircle size={24}/></button>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl mb-4 shrink-0">
               {['total', 'classic', 'kill'].map(sortMode => (
                  <button key={sortMode} onClick={() => setLeaderboardSort(sortMode)} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg uppercase transition-all ${leaderboardSort === sortMode ? 'bg-white shadow-md text-indigo-600 scale-100' : 'text-gray-500 hover:bg-gray-200 scale-95'}`}>
                      {t[sortMode]}
                  </button>
               ))}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
               {sortedLeaderboard.map((u, i) => (
                  <div key={u.id} className={`flex items-center justify-between p-3 rounded-2xl border ${i === 0 ? 'bg-yellow-50 border-yellow-200 shadow-sm' : i === 1 ? 'bg-gray-50 border-gray-300' : i === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                     <div className="flex items-center gap-3">
                        <span className={`font-black text-xl w-6 text-center tracking-tighter ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300 text-sm'}`}>#{i + 1}</span>
                        <span className="font-bold text-sm text-gray-800 truncate max-w-[120px]">{u.displayName}</span>
                     </div>
                     <div className="text-right">
                        <span className="block text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">{u[leaderboardSort + 'Wins'] || 0} {t.wins}</span>
                     </div>
                  </div>
               ))}
               {sortedLeaderboard.length === 0 && <p className="text-center text-gray-400 font-bold text-xs py-8 opacity-50">No ranked players yet.</p>}
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-8 max-sm:p-6 max-w-sm w-full animate-in zoom-in duration-300">
                  <div className="flex flex-col items-center mb-6 text-center">
                      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-4"><ShieldCheck size={32} /></div>
                      <h2 className="text-2xl font-black text-gray-900 leading-none">{t.loginTitle}</h2>
                  </div>
                  {authErrorMsg && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-[10px] font-bold"><AlertCircle size={14} />{authErrorMsg}</div>}
                  <form onSubmit={handleAuth} className="space-y-4">
                      {authMode === 'signup' && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">{t.username}</label>
                            <div className="relative"><User className="absolute left-3 top-3 text-gray-400" size={16} /><input required type="text" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
                        </div>
                      )}
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">{t.email}</label>
                          <div className="relative"><Mail className="absolute left-3 top-3 text-gray-400" size={16} /><input required type="email" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">{t.password}</label>
                          <div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={16} /><input required type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" /></div>
                      </div>
                      <button disabled={authLoading} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50">{authLoading ? '...' : (authMode === 'login' ? t.signIn : t.signUp)}</button>
                  </form>
                  <div className="mt-6 text-center">
                      <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-xs font-bold text-indigo-600 hover:underline">{authMode === 'login' ? t.noAccount : t.hasAccount}</button>
                      <div className="mt-4 pt-4 border-t border-gray-100"><button onClick={() => setIsAuthModalOpen(false)} className="text-xs text-gray-400 font-bold hover:text-gray-600">{t.modalCancel}</button></div>
                  </div>
              </div>
          </div>
      )}
      {showResetModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 text-center">
            <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-[280px] w-full animate-in zoom-in slide-in-from-bottom-2 duration-200">
                <h3 className="text-base font-black mb-1 text-gray-900">{t.modalTitle}</h3>
                <p className="text-gray-500 text-[10px] mb-6 leading-relaxed">{t.modalBody}</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowResetModal(false)} className="flex-1 py-2 text-[10px] text-gray-500 font-bold hover:bg-gray-50 rounded-lg">{t.modalCancel}</button>
                    <button onClick={resetGame} className="flex-1 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg shadow-lg active:scale-95 transition-all">{t.modalConfirm}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}