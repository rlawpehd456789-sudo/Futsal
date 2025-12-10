import React, { useState, useEffect } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { database } from '../firebase';
import { Cloud, CloudRain, Wind, AlertTriangle, Users, Clock, UserCircle, Pencil, CheckCircle2, XCircle, Target, AlertCircle, Flame } from 'lucide-react';
import { Typewriter } from './ui/typewriter-text';

const FutsalAttendance = () => {

  const [nickname, setNickname] = useState('');

  const [isRegistered, setIsRegistered] = useState(false);

  const [myStatus, setMyStatus] = useState('none');

  const [participants, setParticipants] = useState([]);

  const [weather, setWeather] = useState({ condition: 'clear', temp: 18 });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDateKey, setCurrentDateKey] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  });

  const [inputNickname, setInputNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');

  // 今日の日付キー生成 (YYYY-MM-DD形式)
  const getTodayKey = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  };

  // 固有ユーザーID取得または生成
  const getOrCreateUserId = () => {
    let userId = localStorage.getItem('futsalUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('futsalUserId', userId);
    }
    return userId;
  };

  useEffect(() => {
    // ニックネーム確認
    const storedNickname = localStorage.getItem('futsalNickname');
    if (storedNickname) {
      setNickname(storedNickname);
      setIsRegistered(true);
    }

    // リアルタイム時間更新 (1秒ごと)
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // 日付が変わったか確認
      const newDateKey = now.toISOString().split('T')[0];
      if (newDateKey !== currentDateKey) {
        setCurrentDateKey(newDateKey);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [currentDateKey]);

  // 日付が変わるたびにFirebaseリスナー再設定
  useEffect(() => {
    const todayKey = getTodayKey();
    const attendanceRef = ref(database, `attendance/${todayKey}`);

    // リアルタイムリスナー接続
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      const currentNickname = localStorage.getItem('futsalNickname'); // 現在のニックネーム取得
      
      if (data && data.participants) {
        setParticipants(data.participants || []);
        
        // 自分の状態更新
        if (currentNickname) {
          const myData = data.participants.find(p => p.nickname === currentNickname);
          if (myData) {
            setMyStatus(myData.status);
          } else {
            setMyStatus('none');
          }
        }
      } else {
        // データがなければ空配列
        setParticipants([]);
        if (currentNickname) {
          setMyStatus('none');
        }
      }
    }, (error) => {
      console.error('Firebaseリアルタイム更新エラー:', error);
    });

    return () => {
      unsubscribe(); // Firebaseリスナー削除
    };
  }, [currentDateKey]);


  const handleRegister = async () => {
    const trimmedNickname = inputNickname.trim();
    
    if (!trimmedNickname) {
      setNicknameError('ニックネームを入力してください。');
      return;
    }

    // ニックネーム長さ検証 (10文字制限)
    if (trimmedNickname.length > 10) {
      setNicknameError('ニックネームは最大10文字まで入力可能です。');
      return;
    }

    // エラーメッセージ初期化
    setNicknameError('');

    try {
      const userId = getOrCreateUserId();
      
      // Firebaseからすべての日付の参加者リスト取得
      const attendanceRef = ref(database, 'attendance');
      const snapshot = await get(attendanceRef);
      
      const allNicknames = new Set();
      let previousNickname = null;
      let previousStatus = null;
      let previousTime = null;
      
      if (snapshot.exists()) {
        const attendanceData = snapshot.val();
        
        // ユーザーマッピング確認
        const userMappingRef = ref(database, `userMappings/${userId}`);
        const userMappingSnapshot = await get(userMappingRef);
        
        if (userMappingSnapshot.exists()) {
          previousNickname = userMappingSnapshot.val().nickname;
        }
        
        // すべての日付の参加者リストを順番に回りながらニックネーム収集および以前のニックネーム検索
        Object.keys(attendanceData).forEach(dateKey => {
          const dateData = attendanceData[dateKey];
          if (dateData && dateData.participants && Array.isArray(dateData.participants)) {
            dateData.participants.forEach(participant => {
              if (participant.nickname) {
                allNicknames.add(participant.nickname.toLowerCase());
                
                // 以前のニックネームで投票した記録があれば保存
                if (previousNickname && participant.nickname === previousNickname) {
                  previousStatus = participant.status;
                  previousTime = participant.time;
                }
              }
            });
          }
        });
      }

      // ニックネーム重複チェック (大文字小文字区別なし、ただし同じユーザーが以前に使用したニックネームでなければならない)
      if (allNicknames.has(trimmedNickname.toLowerCase()) && trimmedNickname.toLowerCase() !== previousNickname?.toLowerCase()) {
        setNicknameError('既に使用されているニックネームです。別のニックネームを入力してください。');
        return;
      }

      // 以前のニックネームで投票した記録があればすべての日付から削除
      if (previousNickname && previousNickname !== trimmedNickname) {
        const attendanceRef = ref(database, 'attendance');
        const allAttendanceSnapshot = await get(attendanceRef);
        
        if (allAttendanceSnapshot.exists()) {
          const attendanceData = allAttendanceSnapshot.val();
          const updates = {};
          
          // すべての日付から以前のニックネーム削除
          Object.keys(attendanceData).forEach(dateKey => {
            const dateData = attendanceData[dateKey];
            if (dateData && dateData.participants && Array.isArray(dateData.participants)) {
              const filteredParticipants = dateData.participants.filter(
                p => p.nickname !== previousNickname
              );
              
              if (filteredParticipants.length !== dateData.participants.length) {
                updates[`attendance/${dateKey}/participants`] = filteredParticipants;
              }
            }
          });
          
          // 複数の日付同時更新
          if (Object.keys(updates).length > 0) {
            await Promise.all(
              Object.entries(updates).map(([path, value]) => {
                const pathRef = ref(database, path);
                return set(pathRef, value);
              })
            );
          }
        }
      }

      // ユーザーマッピング更新
      const userMappingRef = ref(database, `userMappings/${userId}`);
      await set(userMappingRef, {
        nickname: trimmedNickname,
        updatedAt: new Date().toISOString()
      });

      // 重複がなければ登録進行
      localStorage.setItem('futsalNickname', trimmedNickname);
      setNickname(trimmedNickname);
      setIsRegistered(true);
      setNicknameError('');

      // 以前の状態があってニックネームが変わったなら新しいニックネームで状態復元
      if (previousNickname && previousNickname !== trimmedNickname && previousStatus) {
        // 少しの遅延後状態更新 (Firebase更新完了待機)
        setTimeout(() => {
          updateStatus(previousStatus);
        }, 500);
      }

    } catch (error) {
      console.error('ニックネーム登録失敗:', error);
      setNicknameError('ニックネーム確認中にエラーが発生しました。再度お試しください。');
    }
  };

  const updateStatus = async (status) => {
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 既存参加者リストから自分の情報削除
    let updatedParticipants = participants.filter(p => p.nickname !== nickname);

    // 新しい状態追加 (noneでなければ)
    if (status !== 'none') {
      updatedParticipants.push({
        nickname,
        status,
        time: timeStr
      });
    }

    // ローカル状態更新
    setParticipants(updatedParticipants);
    setMyStatus(status);

    // Firebaseに保存
    try {
      const todayKey = getTodayKey();
      const attendanceRef = ref(database, `attendance/${todayKey}`);
      
      await set(attendanceRef, {
        participants: updatedParticipants,
        date: new Date().toDateString(),
        lastUpdated: now.toISOString()
      });
    } catch (error) {
      console.error('Firebase保存失敗:', error);
      // エラー発生時ユーザーに通知 (オプション)
      alert('状態更新に失敗しました。再度お試しください。');
    }
  };

  const getStatusCount = (status) => {

    return participants.filter(p => p.status === status).length;

  };

  const joinCount = getStatusCount('join');

  const passCount = getStatusCount('pass');

  const getStatusColor = () => {

    if (joinCount >= 4) return 'bg-green-500';

    if (joinCount >= 2) return 'bg-yellow-500';

    return 'bg-gray-400';

  };

  const getStatusMessage = () => {
    if (joinCount >= 4) {
      return {
        icon: Target,
        text: '試合可能です！',
        color: 'text-white'
      };
    }
    if (joinCount >= 2) {
      return {
        icon: Users,
        text: 'パス練習可能です！',
        color: 'text-white'
      };
    }
    return {
      icon: AlertCircle,
      text: 'まだ人数が不足しています',
      color: 'text-white/80'
    };
  };

  const isCloseToLunchTime = () => {

    const hour = currentTime.getHours();

    const minute = currentTime.getMinutes();

    return (hour === 12 && minute >= 20) || (hour === 11 && minute >= 50);

  };

  const shouldShowWeatherWarning = () => {

    return weather.condition === 'rain' || weather.condition === 'storm';

  };

  if (!isRegistered) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-10 max-w-md w-full transform transition-all hover:scale-[1.02]">

          <div className="text-center mb-10">

            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full mb-6 shadow-lg">
              <span className="text-5xl">⚽</span>
            </div>

            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3 whitespace-nowrap">
              <Typewriter
                text={["Today's Lunch Soccer"]}
                speed={100}
                loop={true}
                className="text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"
              />
            </h1>

            <p className="text-gray-600 text-base font-medium">ニックネームを入力してください</p>

          </div>

          

          <div className="space-y-3">

            <input

              type="text"

              value={inputNickname}

              onChange={(e) => {
                setInputNickname(e.target.value);
                setNicknameError(''); // 入力時エラーメッセージ初期化
              }}

              onKeyPress={(e) => e.key === 'Enter' && handleRegister()}

              placeholder="例: サッカー王、ピカチュウ"

              className={`w-full px-5 py-4 border-2 rounded-2xl text-base font-medium focus:outline-none transition-all duration-200 ${
                nicknameError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                  : 'border-gray-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100'
              }`}

              maxLength={10}

            />

            <p className="text-gray-400 text-xs font-medium px-2">
              ニックネームは最大10文字まで入力可能です。
            </p>

            {nicknameError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-sm font-medium">{nicknameError}</p>
              </div>
            )}

            <button

              onClick={handleRegister}

              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-2xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"

              disabled={!inputNickname.trim()}

            >

              開始する

            </button>

          </div>

        </div>

      </div>

    );

  }

  return (

    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pb-20">

      {/* Weather Warning */}

      {shouldShowWeatherWarning() && (

        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-4 flex items-center gap-3 shadow-lg">

          <AlertTriangle size={22} className="animate-pulse" />

          <span className="font-semibold">今日は雨が予想されます。安全のため、屋内活動を推奨します。</span>

        </div>

      )}

      {/* Header */}

      <div className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 px-4 py-5 sticky top-0 z-10">

        <div className="max-w-2xl mx-auto">

          <div className="flex justify-between items-center">

            <div>

              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                <Typewriter
                  text={["Today's Lunch Soccer"]}
                  speed={100}
                  loop={true}
                  className="text-2xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"
                />
              </h1>

              <p className="text-gray-900 text-sm font-medium mt-1">

                {currentTime.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}

                <span className="ml-2 text-gray-900 font-semibold">12:30~12:55</span>

              </p>

            </div>

            <div className="flex items-center gap-3">
              {/* ニックネームカード */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-lg">
                <UserCircle size={18} className="text-white/80" />
                <span className="text-sm font-semibold text-white">{nickname}</span>
              </div>

              {/* ニックネーム変更ボタン */}
              <button 
                onClick={async () => {
                  const userId = getOrCreateUserId();
                  const currentNick = nickname;
                  
                  // 現在のニックネームで投票した記録があれば削除
                  if (currentNick) {
                    try {
                      const attendanceRef = ref(database, 'attendance');
                      const allAttendanceSnapshot = await get(attendanceRef);
                      
                      if (allAttendanceSnapshot.exists()) {
                        const attendanceData = allAttendanceSnapshot.val();
                        const updates = {};
                        
                        // すべての日付から現在のニックネーム削除
                        Object.keys(attendanceData).forEach(dateKey => {
                          const dateData = attendanceData[dateKey];
                          if (dateData && dateData.participants && Array.isArray(dateData.participants)) {
                            const filteredParticipants = dateData.participants.filter(
                              p => p.nickname !== currentNick
                            );
                            
                            if (filteredParticipants.length !== dateData.participants.length) {
                              updates[`attendance/${dateKey}/participants`] = filteredParticipants;
                            }
                          }
                        });
                        
                        // 複数の日付同時更新
                        if (Object.keys(updates).length > 0) {
                          await Promise.all(
                            Object.entries(updates).map(([path, value]) => {
                              const pathRef = ref(database, path);
                              return set(pathRef, value);
                            })
                          );
                        }
                      }
                    } catch (error) {
                      console.error('以前の投票記録削除失敗:', error);
                    }
                  }
                  
                  localStorage.removeItem('futsalNickname');
                  setIsRegistered(false);
                  setMyStatus('none');
                  setInputNickname('');
                }}
                className="group flex items-center gap-1.5 px-4 py-2 bg-white/90 hover:bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                <Pencil size={14} className="text-gray-600 group-hover:text-emerald-600 transition-colors" />
                <span className="text-xs font-semibold text-gray-700 group-hover:text-emerald-600 transition-colors">変更</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Main Content */}

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Attendance Count */}

        <div className={`${getStatusColor()} rounded-3xl p-10 text-white text-center mb-8 shadow-2xl transition-all transform hover:scale-[1.02] relative overflow-hidden`}>

          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          <div className="relative z-10">
            <div className="text-xl font-semibold mb-3">現在の参加者</div>

            <div className="text-7xl font-extrabold mb-3 drop-shadow-lg">{joinCount}名</div>

            {(() => {
              const statusMsg = getStatusMessage();
              const IconComponent = statusMsg.icon;
              return (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <IconComponent size={20} className={statusMsg.color} />
                  </div>
                  <span className={`text-lg font-semibold ${statusMsg.color}`}>
                    {statusMsg.text}
                  </span>
                </div>
              );
            })()}

            {isCloseToLunchTime() && joinCount >= 4 && (

              <div className="mt-4 flex items-center justify-center gap-2 text-lg font-bold animate-pulse">

                <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                  <Flame size={18} className="text-white" />
                </div>
                <span>もうすぐ始まります！</span>

              </div>

            )}
          </div>

        </div>

        {/* Status Buttons */}

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6 mb-6">

          <h2 className="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></span>
            私の参加意思
          </h2>

          <div className="space-y-3">

            <button

              onClick={() => updateStatus(myStatus === 'join' ? 'none' : 'join')}

              className={`w-full py-4 px-5 rounded-2xl font-bold text-lg transition-all duration-200 transform flex items-center justify-center gap-3 ${
                myStatus === 'join'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl scale-105 hover:shadow-2xl'
                  : 'bg-gray-100 text-gray-700 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:border-2 hover:border-emerald-200 hover:scale-[1.02] active:scale-[0.98] border-2 border-transparent'
              }`}

            >

              <div className={`p-2 rounded-xl transition-all ${
                myStatus === 'join'
                  ? 'bg-white/20 backdrop-blur-sm'
                  : 'bg-emerald-100'
              }`}>
                <CheckCircle2 
                  size={24} 
                  className={myStatus === 'join' ? 'text-white' : 'text-emerald-600'} 
                />
              </div>
              <span>参加します</span>
              <span className={`px-3 py-1 rounded-full text-base font-semibold ${
                myStatus === 'join'
                  ? 'bg-white/20 backdrop-blur-sm text-white'
                  : 'bg-emerald-500 text-white'
              }`}>
                {joinCount}
              </span>

            </button>

            

            <button

              onClick={() => updateStatus(myStatus === 'pass' ? 'none' : 'pass')}

              className={`w-full py-4 px-5 rounded-2xl font-bold text-lg transition-all duration-200 transform flex items-center justify-center gap-3 ${
                myStatus === 'pass'
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-xl scale-105 hover:shadow-2xl'
                  : 'bg-gray-100 text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:border-2 hover:border-red-200 hover:scale-[1.02] active:scale-[0.98] border-2 border-transparent'
              }`}

            >

              <div className={`p-2 rounded-xl transition-all ${
                myStatus === 'pass'
                  ? 'bg-white/20 backdrop-blur-sm'
                  : 'bg-red-100'
              }`}>
                <XCircle 
                  size={24} 
                  className={myStatus === 'pass' ? 'text-white' : 'text-red-600'} 
                />
              </div>
              <span>不参加です</span>
              <span className={`px-3 py-1 rounded-full text-base font-semibold ${
                myStatus === 'pass'
                  ? 'bg-white/20 backdrop-blur-sm text-white'
                  : 'bg-red-500 text-white'
              }`}>
                {passCount}
              </span>

            </button>

          </div>

        </div>

        {/* Participants List */}

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8">

          <h2 className="text-xl font-extrabold text-gray-800 mb-6 flex items-center gap-3">

            <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl">
              <Users size={20} className="text-emerald-600" />
            </div>
            参加者リスト

          </h2>

          

          {participants.length === 0 ? (

            <div className="text-center py-12">
              <div className="text-5xl mb-4">⚽</div>
              <p className="text-gray-500 font-medium">まだ参加意思を表明した人がいません</p>
            </div>

          ) : (

            <div className="grid grid-cols-2 gap-3">

              {participants

                .sort((a, b) => {

                  const order = { join: 0, pass: 1 };

                  return (order[a.status] ?? 2) - (order[b.status] ?? 2);

                })

                .map((p, idx) => (

                  <div

                    key={idx}

                    className={`flex flex-col p-4 rounded-2xl transition-all duration-200 transform hover:scale-[1.02] ${
                      p.nickname === nickname 
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 shadow-md' 
                        : 'bg-gray-50/80 hover:bg-gray-100 border border-gray-200'
                    }`}

                  >

                    <div className="flex items-center gap-3">

                      <div className={`p-2 rounded-xl transition-all ${
                        p.status === 'join' 
                          ? 'bg-emerald-100' 
                          : 'bg-red-100'
                      }`}>
                        {p.status === 'join' ? (
                          <CheckCircle2 
                            size={20} 
                            className="text-emerald-600" 
                          />
                        ) : (
                          <XCircle 
                            size={20} 
                            className="text-red-600" 
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">

                        <div className="font-semibold text-gray-800 flex items-center gap-2 truncate">

                          <span className="truncate">{p.nickname}</span>

                          {p.nickname === nickname && (

                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full flex-shrink-0">私</span>

                          )}

                        </div>

                        <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">

                          <Clock size={12} />

                          {p.time} 表示

                        </div>

                      </div>

                    </div>

                  </div>

                ))}

            </div>

          )}

        </div>

        {/* Info Box */}

        <div className="mt-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200 shadow-lg">

          <div className="space-y-2 text-sm text-gray-700">
            <p className="flex items-center gap-2 font-semibold">
              <span className="text-lg">💡</span>
              <strong className="text-emerald-700">4名以上</strong>なら試合ができます
            </p>
            <p className="flex items-center gap-2 font-semibold">
              <span className="text-lg">💡</span>
              <strong className="text-teal-700">2-3名</strong>ならパス練習が可能です
            </p>
          </div>

        </div>

      </div>

    </div>

  );

};

export default FutsalAttendance;
