import React, { useState, useEffect, useRef } from 'react';
import { Skull, Heart, Coins, ShoppingBag, Sword, Shield, Zap, User, Wifi, WifiOff, Copy, Users, Settings } from 'lucide-react';

const DNDGame = () => {
  const [gameState, setGameState] = useState('config'); // config, menu, lobby, setup, playing, shop
  const [firebaseUrl, setFirebaseUrl] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [actionLog, setActionLog] = useState([]);
  const [playerAction, setPlayerAction] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [syncError, setSyncError] = useState('');
  
  const pollIntervalRef = useRef(null);
  
  const [players, setPlayers] = useState([
    { id: 1, name: 'Игрок 1', health: 100, strength: 10, agility: 10, intelligence: 10, gold: 50, inventory: [], connected: false },
    { id: 2, name: 'Игрок 2', health: 100, strength: 10, agility: 10, intelligence: 10, gold: 50, inventory: [], connected: false },
    { id: 3, name: 'Игрок 3', health: 100, strength: 10, agility: 10, intelligence: 10, gold: 50, inventory: [], connected: false },
    { id: 4, name: 'Игрок 4', health: 100, strength: 10, agility: 10, intelligence: 10, gold: 50, inventory: [], connected: false }
  ]);

  const genres = [
    { id: 'horror', name: 'Хоррор', desc: 'Мрачные коридоры, древнее зло и ужасающие тайны', icon: '🏚️' },
    { id: 'fantasy', name: 'Фэнтези', desc: 'Магия, драконы и эпические приключения', icon: '🐉' },
    { id: 'cyberpunk', name: 'Киберпанк', desc: 'Неоновые улицы, киборги и корпоративные заговоры', icon: '🤖' },
    { id: 'postapoc', name: 'Постапокалипсис', desc: 'Выживание в разрушенном мире', icon: '☢️' }
  ];

  const shopItems = [
    { id: 1, name: 'Зелье здоровья', cost: 20, effect: 'health', value: 30, icon: '🧪' },
    { id: 2, name: 'Меч', cost: 50, effect: 'strength', value: 5, icon: '⚔️' },
    { id: 3, name: 'Легкая броня', cost: 40, effect: 'health', value: 20, icon: '🛡️' },
    { id: 4, name: 'Амулет удачи', cost: 60, effect: 'agility', value: 5, icon: '💎' },
    { id: 5, name: 'Книга заклинаний', cost: 55, effect: 'intelligence', value: 5, icon: '📖' }
  ];

  // Save Firebase URL to memory
  const saveFirebaseConfig = () => {
    if (!firebaseUrl.trim()) {
      alert('Пожалуйста, введите URL Firebase');
      return;
    }
    
    let url = firebaseUrl.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    if (!url.endsWith('/')) {
      url = url + '/';
    }
    
    setFirebaseUrl(url);
    setGameState('menu');
  };

  // Firebase operations
  const writeToFirebase = async (path, data) => {
    try {
      const response = await fetch(`${firebaseUrl}${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Firebase write failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Firebase write error:', error);
      setSyncError('Ошибка записи в Firebase');
      throw error;
    }
  };

  const readFromFirebase = async (path) => {
    try {
      const response = await fetch(`${firebaseUrl}${path}.json`);
      
      if (!response.ok) {
        throw new Error('Firebase read failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Firebase read error:', error);
      setSyncError('Ошибка чтения из Firebase');
      throw error;
    }
  };

  // Start polling for updates
  const startPolling = (code) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await readFromFirebase(`rooms/${code}`);
        if (data) {
          setPlayers(data.players || players);
          setGameState(data.gameState || gameState);
          setSelectedGenre(data.selectedGenre || '');
          setStory(data.story || '');
          setActionLog(data.actionLog || []);
          setCurrentPlayerIndex(data.currentPlayerIndex || 0);
          setChatMessages(data.chatMessages || []);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  // Stop polling
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Create room
  const createRoom = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setIsHost(true);
    setMyPlayerId(1);
    setConnectionStatus('hosting');
    
    const updatedPlayers = [...players];
    updatedPlayers[0].connected = true;
    setPlayers(updatedPlayers);
    
    const roomData = {
      host: true,
      players: updatedPlayers,
      gameState: 'lobby',
      selectedGenre: '',
      story: '',
      actionLog: [],
      currentPlayerIndex: 0,
      chatMessages: [],
      createdAt: Date.now()
    };
    
    try {
      await writeToFirebase(`rooms/${code}`, roomData);
      setGameState('lobby');
      startPolling(code);
    } catch (error) {
      setConnectionStatus('error');
      alert('Ошибка создания комнаты. Проверьте URL Firebase.');
    }
  };

  // Join room
  const joinRoom = async () => {
    if (!inputRoomCode.trim()) return;
    
    const code = inputRoomCode.toUpperCase();
    setRoomCode(code);
    setIsHost(false);
    setConnectionStatus('connecting');
    
    try {
      const roomData = await readFromFirebase(`rooms/${code}`);
      
      if (!roomData) {
        throw new Error('Room not found');
      }
      
      setPlayers(roomData.players);
      setGameState('lobby');
      setConnectionStatus('connected');
      startPolling(code);
    } catch (error) {
      setConnectionStatus('error');
      alert('Комната не найдена. Проверьте код.');
    }
  };

  // Update Firebase
  const updateFirebase = async (updates) => {
    if (!roomCode) return;
    
    try {
      const currentData = await readFromFirebase(`rooms/${roomCode}`);
      const newData = { ...currentData, ...updates };
      await writeToFirebase(`rooms/${roomCode}`, newData);
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  // Select player slot
  const selectPlayerSlot = async (slotId) => {
    if (players[slotId - 1].connected && players[slotId - 1].id !== myPlayerId) {
      alert('Этот слот уже занят!');
      return;
    }
    
    const updatedPlayers = [...players];
    
    if (myPlayerId) {
      updatedPlayers[myPlayerId - 1].connected = false;
    }
    
    updatedPlayers[slotId - 1].connected = true;
    setMyPlayerId(slotId);
    setPlayers(updatedPlayers);
    
    await updateFirebase({ players: updatedPlayers });
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const message = {
      player: `Игрок ${myPlayerId}`,
      text: chatInput,
      timestamp: Date.now()
    };
    
    const newMessages = [...chatMessages, message];
    setChatMessages(newMessages);
    setChatInput('');
    
    await updateFirebase({ chatMessages: newMessages });
  };

  // Generate story
  const generateStory = async (genre) => {
    if (!isHost) return;
    
    setLoading(true);
    try {
      const genrePrompts = {
        horror: 'жуткий хоррор с мистическими элементами, заброшенными местами и древним злом',
        fantasy: 'эпическое фэнтези приключение с магией, мифическими существами и древними артефактами',
        cyberpunk: 'мрачный киберпанк с корпоративными интригами, хакерами и технологическим беспределом',
        postapoc: 'постапокалиптический мир с выживанием, мутантами и поиском ресурсов'
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `Создай уникальный сюжет для текстовой RPG игры в жанре ${genrePrompts[genre]}. 
              
              В игре участвуют 4 игрока. Опиши:
              1. Начальную локацию и атмосферу (2-3 предложения)
              2. Главную угрозу или цель приключения
              3. Первую ситуацию, с которой столкнулись игроки
              
              Сделай описание атмосферным и захватывающим. Текст должен быть на русском языке.`
            }
          ]
        })
      });

      const data = await response.json();
      const generatedStory = data.content[0].text;
      
      setStory(generatedStory);
      const newLog = [{ type: 'story', text: generatedStory }];
      setActionLog(newLog);
      setGameState('playing');
      
      await updateFirebase({
        story: generatedStory,
        actionLog: newLog,
        gameState: 'playing'
      });
    } catch (error) {
      console.error('Error generating story:', error);
      setStory('Ошибка при генерации сюжета. Попробуйте еще раз.');
    }
    setLoading(false);
  };

  // Handle action
  const handleAction = async () => {
    if (!playerAction.trim() || myPlayerId !== currentPlayerIndex + 1) return;

    const currentPlayer = players[currentPlayerIndex];
    setLoading(true);

    const newLog = [...actionLog, { 
      type: 'action', 
      player: currentPlayer.name, 
      text: playerAction 
    }];
    setActionLog(newLog);
    setPlayerAction('');

    try {
      const gameHistory = actionLog.map(log => {
        if (log.type === 'story') return `Сюжет: ${log.text}`;
        if (log.type === 'action') return `${log.player}: ${log.text}`;
        if (log.type === 'result') return `Результат: ${log.text}`;
        return '';
      }).join('\n\n');

      const playersInfo = players.map(p => 
        `${p.name}: Здоровье ${p.health}, Сила ${p.strength}, Ловкость ${p.agility}, Интеллект ${p.intelligence}, Золото ${p.gold}`
      ).join('\n');

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: `Ты - мастер DND игры. Вот текущее состояние игры:

ИСТОРИЯ ИГРЫ:
${gameHistory}

СОСТОЯНИЕ ИГРОКОВ:
${playersInfo}

ДЕЙСТВИЕ ТЕКУЩЕГО ИГРОКА (${currentPlayer.name}):
${playerAction}

Опиши результат этого действия (2-4 предложения). Включи:
1. Что произошло в результате действия
2. Если нужно, измени характеристики игрока (урон/исцеление/награда)
3. Развитие сюжета

В конце ответа добавь в формате JSON изменения характеристик (если есть):
{"healthChange": число, "goldChange": число}

Если изменений нет, используй 0. Пиши на русском языке.`
            }
          ]
        })
      });

      const data = await response.json();
      let resultText = data.content[0].text;
      
      const jsonMatch = resultText.match(/\{[^}]*"healthChange"[^}]*\}/);
      let changes = { healthChange: 0, goldChange: 0 };
      
      if (jsonMatch) {
        try {
          changes = JSON.parse(jsonMatch[0]);
          resultText = resultText.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.log('Could not parse changes');
        }
      }

      const updatedPlayers = [...players];
      updatedPlayers[currentPlayerIndex] = {
        ...currentPlayer,
        health: Math.max(0, Math.min(100, currentPlayer.health + (changes.healthChange || 0))),
        gold: Math.max(0, currentPlayer.gold + (changes.goldChange || 0))
      };
      
      const finalLog = [...newLog, { type: 'result', text: resultText }];
      const nextPlayerIndex = (currentPlayerIndex + 1) % 4;
      
      setPlayers(updatedPlayers);
      setActionLog(finalLog);
      setCurrentPlayerIndex(nextPlayerIndex);

      await updateFirebase({
        actionLog: finalLog,
        currentPlayerIndex: nextPlayerIndex,
        players: updatedPlayers
      });
    } catch (error) {
      console.error('Error processing action:', error);
      setActionLog([...newLog, { type: 'result', text: 'Ошибка при обработке действия.' }]);
    }
    setLoading(false);
  };

  // Buy item
  const buyItem = async (item) => {
    if (myPlayerId === null) return;
    
    const playerIndex = myPlayerId - 1;
    const currentPlayer = players[playerIndex];
    
    if (currentPlayer.gold < item.cost) {
      alert('Недостаточно золота!');
      return;
    }

    const updatedPlayers = [...players];
    const playerToUpdate = updatedPlayers[playerIndex];
    
    playerToUpdate.gold -= item.cost;
    playerToUpdate.inventory.push(item.name);
    
    if (item.effect === 'health') {
      playerToUpdate.health = Math.min(100, playerToUpdate.health + item.value);
    } else if (item.effect === 'strength') {
      playerToUpdate.strength += item.value;
    } else if (item.effect === 'agility') {
      playerToUpdate.agility += item.value;
    } else if (item.effect === 'intelligence') {
      playerToUpdate.intelligence += item.value;
    }
    
    setPlayers(updatedPlayers);
    await updateFirebase({ players: updatedPlayers });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert('Код комнаты скопирован!');
  };

  const handleGenreSelect = async (genreId) => {
    setSelectedGenre(genreId);
    if (isHost) {
      await updateFirebase({ selectedGenre: genreId });
    }
  };

  const startGame = async () => {
    if (!isHost) return;
    setGameState('setup');
    await updateFirebase({ gameState: 'setup' });
  };

  // Config screen
  if (gameState === 'config') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <Settings className="w-20 h-20 mx-auto mb-4 text-blue-500" />
            <h1 className="text-5xl font-bold mb-4 text-red-500">Настройка Firebase</h1>
            <p className="text-xl text-gray-300 mb-8">Введите URL вашей Firebase Realtime Database</p>
          </div>

          <div className="bg-gray-800 border-2 border-gray-700 rounded-lg p-8 mb-6">
            <h3 className="text-xl font-bold mb-4 text-yellow-400">📋 Как получить Firebase URL:</h3>
            <ol className="text-gray-300 space-y-2 mb-6 text-sm">
              <li>1. Перейдите на <a href="https://console.firebase.google.com/" target="_blank" className="text-blue-400 underline">console.firebase.google.com</a></li>
              <li>2. Создайте новый проект (или выберите существующий)</li>
              <li>3. В левом меню выберите "Realtime Database"</li>
              <li>4. Нажмите "Создать базу данных"</li>
              <li>5. Выберите регион и начните в <strong>тестовом режиме</strong></li>
              <li>6. Скопируйте URL базы данных (например: <code className="bg-gray-900 px-2 py-1 rounded">your-project.firebaseio.com</code>)</li>
            </ol>

            <input
              type="text"
              value={firebaseUrl}
              onChange={(e) => setFirebaseUrl(e.target.value)}
              placeholder="https://your-project.firebaseio.com"
              className="w-full bg-gray-900 text-white border-2 border-gray-700 rounded p-4 mb-4 text-center"
            />
            
            <button
              onClick={saveFirebaseConfig}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all"
            >
              Сохранить и продолжить
            </button>
          </div>

          <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4 text-sm">
            <p className="text-blue-300">💡 <strong>Совет:</strong> Firebase бесплатен для малых проектов. Вам нужно настроить его только один раз!</p>
          </div>
        </div>
      </div>
    );
  }

  // Menu screen
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <Skull className="w-20 h-20 mx-auto mb-4 text-red-500" />
            <h1 className="text-5xl font-bold mb-4 text-red-500">DND Online RPG</h1>
            <p className="text-xl text-gray-300">Многопользовательская текстовая RPG</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 px-8 rounded-lg text-2xl transition-all flex items-center justify-center"
            >
              <Users className="w-8 h-8 mr-3" />
              Создать игру (Хост)
            </button>

            <div className="bg-gray-800 border-2 border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Присоединиться к игре</h3>
              <input
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                placeholder="Введите код комнаты"
                className="w-full bg-gray-900 text-white border-2 border-gray-700 rounded p-3 mb-4 text-center text-2xl tracking-widest"
                maxLength={6}
              />
              <button
                onClick={joinRoom}
                disabled={!inputRoomCode}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all"
              >
                Подключиться
              </button>
            </div>

            {connectionStatus === 'error' && (
              <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4 text-center">
                <WifiOff className="w-8 h-8 mx-auto mb-2 text-red-500" />
                <p className="text-red-400">Ошибка подключения. Проверьте код комнаты.</p>
              </div>
            )}

            <button
              onClick={() => setGameState('config')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center"
            >
              <Settings className="w-5 h-5 mr-2" />
              Изменить Firebase URL
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby screen
  if (gameState === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-red-500">Лобби игры</h1>
            {isHost && (
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-4 inline-block">
                <Wifi className="w-6 h-6 inline mr-2 text-green-500" />
                <span className="text-xl font-bold">Код комнаты: {roomCode}</span>
                <button
                  onClick={copyRoomCode}
                  className="ml-3 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                >
                  <Copy className="w-4 h-4 inline" /> Копировать
                </button>
              </div>
            )}
            {!isHost && (
              <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4 inline-block">
                <Wifi className="w-6 h-6 inline mr-2 text-blue-500" />
                <span className="text-xl">Подключено к: {roomCode}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => selectPlayerSlot(player.id)}
                disabled={player.connected && myPlayerId !== player.id}
                className={`p-6 rounded-lg border-2 transition-all ${
                  myPlayerId === player.id
                    ? 'border-green-500 bg-green-900/30'
                    : player.connected
                    ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed'
                    : 'border-gray-700 bg-gray-800/30 hover:border-blue-500'
                }`}
              >
                <User className={`w-12 h-12 mx-auto mb-3 ${
                  player.connected ? 'text-green-500' : 'text-gray-500'
                }`} />
                <h3 className="text-xl font-bold mb-2">{player.name}</h3>
                <p className={`text-sm ${
                  player.connected ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {myPlayerId === player.id ? 'Вы' : player.connected ? 'Занято' : 'Свободно'}
                </p>
              </button>
            ))}
          </div>

          <div className="bg-gray-800 border-2 border-gray-700 rounded-lg p-4 mb-8 max-h-48 overflow-y-auto">
            <h3 className="text-lg font-bold mb-3 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Чат лобби
            </h3>
            <div className="space-y-2 mb-3">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <span className="text-blue-400 font-bold">{msg.player}:</span>{' '}
                  <span className="text-gray-300">{msg.text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Сообщение..."
                className="flex-1 bg-gray-900 text-white border border-gray-700 rounded p-2 text-sm"
              />
              <button
                onClick={sendChatMessage}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
              >
                Отправить
              </button>
            </div>
          </div>

          {isHost && (
            <button
              onClick={startGame}
              disabled={players.filter(p => p.connected).length < 2}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all"
            >
              {players.filter(p => p.connected).length < 2 
                ? 'Ожидание игроков (минимум 2)...' 
                : 'Начать игру'}
            </button>
          )}
          
          {!isHost && (
            <div className="text-center text-gray-400 text-lg">
              Ожидание начала игры...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup screen
  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Skull className="w-20 h-20 mx-auto mb-4 text-red-500" />
            <h1 className="text-4xl font-bold mb-4 text-red-500">Выберите жанр</h1>
            {!isHost && <p className="text-gray-400">Хост выбирает жанр...</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {genres.map(genre => (
              <button
                key={genre.id}
                onClick={() => handleGenreSelect(genre.id)}
                disabled={!isHost}
                className={`p-6 rounded-lg border-2 transition-all ${
                  selectedGenre === genre.id
                    ? 'border-red-500 bg-red-900/30 scale-105'
                    : 'border-gray-700 bg-gray-800/50 hover:border-red-700'
                } ${!isHost ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="text-4xl mb-3">{genre.icon}</div>
                <h3 className="text-2xl font-bold mb-2">{genre.name}</h3>
                <p className="text-gray-400">{genre.desc}</p>
              </button>
            ))}
          </div>

          {isHost && selectedGenre && (
            <button
              onClick={() => generateStory(selectedGenre)}
              disabled={loading}
              className="mt-8 w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all"
            >
              {loading ? 'Генерация сюжета...' : 'Начать приключение'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Shop screen
  if (gameState === 'shop') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-4xl font-bold mb-2">Магазин</h2>
            <p className="text-gray-400">Покупаете: {players[myPlayerId - 1]?.name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {shopItems.map(item => (
              <div key={item.id} className="bg-gray-800 border-2 border-gray-700 rounded-lg p-6">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="text-xl font-bold mb-2">{item.name}</h3>
                <p className="text-yellow-500 mb-4 flex items-center">
                  <Coins className="w-4 h-4 mr-1" /> {item.cost} золота
                </p>
                <button
                  onClick={() => buyItem(item)}
                  disabled={!myPlayerId || players[myPlayerId - 1]?.gold < item.cost}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-all"
                >
                  Купить
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setGameState('playing')}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            Вернуться к игре
          </button>
        </div>
      </div>
    );
  }

  // Main game screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-red-500 flex items-center">
            <Skull className="w-8 h-8 mr-2" />
            DND Online RPG
          </h1>
          <div className="flex gap-3 items-center">
            <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
              <Wifi className="w-5 h-5 inline mr-2 text-green-500" />
              <span className="text-sm">Комната: {roomCode}</span>
            </div>
            <button
              onClick={() => setGameState('shop')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded flex items-center"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Магазин
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {players.filter(p => p.connected).map((player) => {
            const actualIdx = players.indexOf(player);
            return (
              <div
                key={player.id}
                className={`bg-gray-800 border-2 rounded-lg p-4 transition-all ${
                  actualIdx === currentPlayerIndex
                    ? 'border-red-500 shadow-lg shadow-red-500/50'
                    : player.id === myPlayerId
                    ? 'border-green-500'
                    : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <User className={`w-6 h-6 mr-2 ${
                      player.id === myPlayerId ? 'text-green-400' : 'text-blue-400'
                    }`} />
                    <h3 className="font-bold">
                      {player.name}
                      {player.id === myPlayerId && ' (Вы)'}
                    </h3>
                  </div>
                  {actualIdx === currentPlayerIndex && (
                    <span className="text-xs bg-red-600 px-2 py-1 rounded">ХОД</span>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Heart className="w-4 h-4 mr-1 text-red-500" />
                      Здоровье
                    </span>
                    <span className="font-bold">{player.health}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Sword className="w-4 h-4 mr-1 text-orange-500" />
                      Сила
                    </span>
                    <span className="font-bold">{player.strength}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                      Ловкость
                    </span>
                    <span className="font-bold">{player.agility}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Shield className="w-4 h-4 mr-1 text-blue-500" />
                      Интеллект
                    </span>
                    <span className="font-bold">{player.intelligence}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-700 pt-2">
                    <span className="flex items-center">
                      <Coins className="w-4 h-4 mr-1 text-yellow-500" />
                      Золото
                    </span>
                    <span className="font-bold text-yellow-500">{player.gold}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gray-800 border-2 border-gray-700 rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4 text-red-400">История приключения</h2>
          {actionLog.map((log, idx) => (
            <div key={idx} className="mb-4">
              {log.type === 'story' && (
                <p className="text-gray-300 italic bg-purple-900/30 p-4 rounded">{log.text}</p>
              )}
              {log.type === 'action' && (
                <p className="text-blue-400">
                  <strong>{log.player}:</strong> {log.text}
                </p>
              )}
              {log.type === 'result' && (
                <p className="text-gray-300 bg-gray-900/50 p-3 rounded mt-2">{log.text}</p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-800 border-2 border-red-500 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-red-400">
            Ход игрока: {players[currentPlayerIndex]?.name}
            {myPlayerId === currentPlayerIndex + 1 && ' (Ваш ход!)'}
          </h3>
          <textarea
            value={playerAction}
            onChange={(e) => setPlayerAction(e.target.value)}
            placeholder={
              myPlayerId === currentPlayerIndex + 1 
                ? "Опишите действие вашего персонажа..." 
                : "Ожидание хода другого игрока..."
            }
            className="w-full bg-gray-900 text-white border-2 border-gray-700 rounded p-4 mb-4 min-h-32 focus:border-red-500 focus:outline-none"
            disabled={loading || myPlayerId !== currentPlayerIndex + 1}
          />
          <button
            onClick={handleAction}
            disabled={loading || !playerAction.trim() || myPlayerId !== currentPlayerIndex + 1}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all"
          >
            {loading ? 'Обработка...' : myPlayerId === currentPlayerIndex + 1 ? 'Выполнить действие' : 'Не ваш ход'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DNDGame;