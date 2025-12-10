import React, { useState, useEffect } from 'react';
import { ref, onValue, set, off } from 'firebase/database';
import { database } from '../firebase';
import { Cloud, CloudRain, Wind, AlertTriangle, Users, Clock } from 'lucide-react';

const FutsalAttendance = () => {

  const [nickname, setNickname] = useState('');

  const [isRegistered, setIsRegistered] = useState(false);

  const [myStatus, setMyStatus] = useState('none');

  const [participants, setParticipants] = useState([]);

  const [weather, setWeather] = useState({ condition: 'clear', temp: 18 });

  const [currentTime, setCurrentTime] = useState(new Date());

  const [inputNickname, setInputNickname] = useState('');

  useEffect(() => {

    // 시간 업데이트 타이머
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Firebase 실시간 리스너 설정
    const todayKey = new Date().toDateString();
    const attendanceRef = ref(database, `attendance/${todayKey}`);

    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.participants) {
        const participantsList = Array.isArray(data.participants) 
          ? data.participants 
          : Object.values(data.participants);
        
        setParticipants(participantsList);
        
        // 내 상태 업데이트
        const storedNickname = localStorage.getItem('futsalNickname');
        if (storedNickname) {
          const myData = participantsList.find(p => p.nickname === storedNickname);
          if (myData) {
            setMyStatus(myData.status);
          } else {
            setMyStatus('none');
          }
        }
      } else {
        setParticipants([]);
        setMyStatus('none');
      }
    }, (error) => {
      console.error('Firebase read error:', error);
    });

    // 닉네임 로드
    const storedNickname = localStorage.getItem('futsalNickname');
    if (storedNickname) {
      setNickname(storedNickname);
      setIsRegistered(true);
    }

    return () => {
      clearInterval(timer);
      off(attendanceRef);
    };

  }, []);


  const handleRegister = () => {

    if (inputNickname.trim()) {

      localStorage.setItem('futsalNickname', inputNickname.trim());

      setNickname(inputNickname.trim());

      setIsRegistered(true);

    }

  };

  const updateStatus = async (status) => {

    if (!nickname) return;

    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayKey = new Date().toDateString();

    // 기존 참가자 목록에서 내 정보 제거
    let updatedParticipants = participants.filter(p => p.nickname !== nickname);

    // 새 상태가 'none'이 아니면 추가
    if (status !== 'none') {
      updatedParticipants.push({
        nickname,
        status,
        time: timeStr
      });
    }

    // Firebase에 저장
    try {
      const attendanceRef = ref(database, `attendance/${todayKey}`);
      await set(attendanceRef, {
        participants: updatedParticipants,
        date: todayKey
      });
      
      setMyStatus(status);
    } catch (error) {
      console.error('Failed to save to Firebase:', error);
    }

  };

  const getStatusCount = (status) => {

    return participants.filter(p => p.status === status).length;

  };

  const joinCount = getStatusCount('join');

  const maybeCount = getStatusCount('maybe');

  const passCount = getStatusCount('pass');

  const getStatusColor = () => {

    if (joinCount >= 4) return 'bg-green-500';

    if (joinCount >= 2) return 'bg-yellow-500';

    return 'bg-gray-400';

  };

  const getStatusMessage = () => {

    if (joinCount >= 4) return '🎯 경기 가능해요!';

    if (joinCount >= 2) return '⚽ 패스 연습 가능해요!';

    return '😢 아직 인원이 부족해요';

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

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">

        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">

          <div className="text-center mb-8">

            <div className="text-6xl mb-4">⚽</div>

            <h1 className="text-3xl font-bold text-gray-800 mb-2">점심 풋살</h1>

            <p className="text-gray-600">닉네임을 입력해주세요</p>

          </div>

          

          <input

            type="text"

            value={inputNickname}

            onChange={(e) => setInputNickname(e.target.value)}

            onKeyPress={(e) => e.key === 'Enter' && handleRegister()}

            placeholder="예: 축구왕, 민수킴"

            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg mb-4 focus:outline-none focus:border-green-500"

            maxLength={10}

          />

          

          <button

            onClick={handleRegister}

            className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-600 transition-colors"

          >

            시작하기

          </button>

        </div>

      </div>

    );

  }

  return (

    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 pb-20">

      {/* Weather Warning */}

      {shouldShowWeatherWarning() && (

        <div className="bg-red-500 text-white px-4 py-3 flex items-center gap-2">

          <AlertTriangle size={20} />

          <span className="font-medium">오늘은 비가 예상됩니다. 안전을 위해 실내 활동을 권장합니다.</span>

        </div>

      )}

      {/* Header */}

      <div className="bg-white shadow-sm px-4 py-4">

        <div className="max-w-2xl mx-auto">

          <div className="flex justify-between items-center">

            <div>

              <h1 className="text-2xl font-bold text-gray-800">오늘의 풋살</h1>

              <p className="text-gray-600 text-sm">

                {currentTime.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}

                <span className="ml-2">12:30~12:55</span>

              </p>

            </div>

            <div className="text-right">

              <p className="text-xs text-gray-500">{nickname}</p>

              <button 

                onClick={() => {

                  localStorage.removeItem('futsalNickname');

                  setIsRegistered(false);

                  setMyStatus('none');

                }}

                className="text-xs text-blue-500 underline"

              >

                닉네임 변경

              </button>

            </div>

          </div>

        </div>

      </div>

      {/* Main Content */}

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Attendance Count */}

        <div className={`${getStatusColor()} rounded-3xl p-8 text-white text-center mb-6 shadow-lg transition-all`}>

          <div className="text-6xl font-bold mb-2">{joinCount}명</div>

          <div className="text-xl font-medium">현재 참가자</div>

          <div className="mt-4 text-lg">{getStatusMessage()}</div>

          {isCloseToLunchTime() && joinCount >= 4 && (

            <div className="mt-3 text-lg font-bold animate-pulse">

              🔥 곧 시작합니다!

            </div>

          )}

        </div>

        {/* Status Buttons */}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">

          <h2 className="text-lg font-bold text-gray-800 mb-4">나의 참가 의사</h2>

          <div className="space-y-3">

            <button

              onClick={() => updateStatus(myStatus === 'join' ? 'none' : 'join')}

              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${

                myStatus === 'join'

                  ? 'bg-green-500 text-white shadow-lg scale-105'

                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

              }`}

            >

              ✅ 참가해요 ({joinCount})

            </button>

            

            <button

              onClick={() => updateStatus(myStatus === 'maybe' ? 'none' : 'maybe')}

              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${

                myStatus === 'maybe'

                  ? 'bg-yellow-500 text-white shadow-lg scale-105'

                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

              }`}

            >

              ❓ 미정이에요 ({maybeCount})

            </button>

            

            <button

              onClick={() => updateStatus(myStatus === 'pass' ? 'none' : 'pass')}

              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${

                myStatus === 'pass'

                  ? 'bg-red-500 text-white shadow-lg scale-105'

                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

              }`}

            >

              ❌ 불참해요 ({passCount})

            </button>

          </div>

        </div>

        {/* Participants List */}

        <div className="bg-white rounded-2xl shadow-lg p-6">

          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">

            <Users size={20} />

            참가자 목록

          </h2>

          

          {participants.length === 0 ? (

            <p className="text-center text-gray-500 py-8">아직 참가 의사를 밝힌 사람이 없어요</p>

          ) : (

            <div className="space-y-2">

              {participants

                .sort((a, b) => {

                  const order = { join: 0, maybe: 1, pass: 2 };

                  return order[a.status] - order[b.status];

                })

                .map((p, idx) => (

                  <div

                    key={idx}

                    className={`flex justify-between items-center p-3 rounded-lg ${

                      p.nickname === nickname ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'

                    }`}

                  >

                    <div className="flex items-center gap-3">

                      <span className="text-2xl">

                        {p.status === 'join' ? '✅' : p.status === 'maybe' ? '❓' : '❌'}

                      </span>

                      <div>

                        <div className="font-medium text-gray-800">

                          {p.nickname}

                          {p.nickname === nickname && (

                            <span className="ml-2 text-xs text-blue-600">(나)</span>

                          )}

                        </div>

                        <div className="text-xs text-gray-500 flex items-center gap-1">

                          <Clock size={12} />

                          {p.time} 표시

                        </div>

                      </div>

                    </div>

                  </div>

                ))}

            </div>

          )}

        </div>

        {/* Info Box */}

        <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-gray-700">

          <p className="mb-1">💡 <strong>4명 이상</strong>이면 경기를 할 수 있어요</p>

          <p>💡 <strong>2-3명</strong>이면 패스 연습이 가능해요</p>

        </div>

      </div>

    </div>

  );

};

export default FutsalAttendance;

