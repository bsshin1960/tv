import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Settings, Tv, 
  Bell, Clock, Sun, Moon, Heart, Download, 
  Minimize, ChevronDown, ChevronUp, Search, Upload, Loader, X
} from 'lucide-react';
import Hls from 'hls.js';
import { CHANNELS, getCurrentProgram } from './data/channels';
import type { Channel, Program } from './data/channels';
import { parseM3U } from './utils/m3uParser';

export default function App() {
  // --- 상태 관리 ---
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [activeChannel, setActiveChannel] = useState<Channel>(CHANNELS[0]);
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    const saved = localStorage.getItem('tv-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  
  // M3U 상태 관리
  const [m3uChannels, setM3uChannels] = useState<Channel[]>([]);
  const [isLoadingM3u, setIsLoadingM3u] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedM3uGroup, setSelectedM3uGroup] = useState<string>('전체');
  const [visibleCount, setVisibleCount] = useState<number>(60);
  const [m3uFileName, setM3uFileName] = useState<string>('');
  
  // 비디오 제어
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [quality, setQuality] = useState<string>('Auto');
  const [videoFilter, setVideoFilter] = useState<string>('none');
  const [brightness, setBrightness] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // 드롭다운 및 아코디언 토글 상태 (풀다운 메뉴 개편 핵심)
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [isSubCategoryOpen, setIsSubCategoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isEpgOpen, setIsEpgOpen] = useState<boolean>(false);
  
  // 예약 알림 및 타이머
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [epgProgressInfo, setEpgProgressInfo] = useState<{
    program: Program;
    progress: number;
    nextProgram: Program | null;
  }>(() => getCurrentProgram(CHANNELS[0]));
  const [reservedAlerts, setReservedAlerts] = useState<{channelId: string, channelName: string, program: Program}[]>(() => {
    const saved = localStorage.getItem('tv-alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [touchIndicator, setTouchIndicator] = useState<{ show: boolean, type: 'volume' | 'brightness', value: number }>({
    show: false,
    type: 'volume',
    value: 0
  });

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  
  // 드롭다운 외부 클릭 시 닫기용 Ref
  const categoryRef = useRef<HTMLDivElement>(null);
  const subCategoryRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 이펙트 ---
  
  // 1. 실시간 시계 & 타이머 & 예약 알림 체크
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      setEpgProgressInfo(getCurrentProgram(activeChannel));
      
      // 취침 타이머
      setSleepTimer(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          setIsPlaying(false);
          if (videoRef.current) videoRef.current.pause();
          return null;
        }
        return prev - 1;
      });

      // 예약 알림 체크
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      reservedAlerts.forEach((alert) => {
        if (alert.program.startTime === currentHHMM) {
          triggerBrowserNotification(alert.channelName, alert.program.title);
          setReservedAlerts(prev => {
            const filtered = prev.filter(a => !(a.channelId === alert.channelId && a.program.startTime === alert.program.startTime));
            localStorage.setItem('tv-alerts', JSON.stringify(filtered));
            return filtered;
          });
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeChannel, reservedAlerts]);

  // 2. 외부 영역 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (subCategoryRef.current && !subCategoryRef.current.contains(e.target as Node)) {
        setIsSubCategoryOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 3. 비디오 채널 스트림 전환
  useEffect(() => {
    if (activeChannel.streamType === 'youtube') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (activeChannel.streamType === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(activeChannel.streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isPlaying) video.play().catch(() => setIsPlaying(false));
        });
        hls.on(Hls.Events.ERROR, function (_, data) {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = activeChannel.streamUrl;
        video.addEventListener('loadedmetadata', () => {
          if (isPlaying) video.play().catch(() => setIsPlaying(false));
        });
      }
    } else {
      video.src = activeChannel.streamUrl;
      video.load();
      if (isPlaying) video.play().catch(() => setIsPlaying(false));
    }
    setEpgProgressInfo(getCurrentProgram(activeChannel));
  }, [activeChannel]);

  // 4. 비디오 재생/정지 제어
  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeChannel.streamType === 'youtube') return;
    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, activeChannel]);

  // 5. 볼륨 제어
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // 6. 다크/라이트 테마 변경
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
  }, [theme]);

  // 7. 즐겨찾기 로컬보존
  useEffect(() => {
    localStorage.setItem('tv-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // 8. PWA 이벤트 캡처
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // --- 알림 & PWA 액션 ---
  const triggerBrowserNotification = (channelName: string, programTitle: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`[TV ON] 시청 예약 알림`, {
        body: `잠시 후 ${channelName}에서 '${programTitle}' 프로그램이 방영됩니다!`,
        icon: '/pwa-192x192.png'
      });
    } else {
      alert(`[알림] 잠시 후 ${channelName}에서 '${programTitle}' 프로그램이 방영됩니다!`);
    }
  };

  const toggleBookmark = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarks(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId) 
        : [...prev, channelId]
    );
  };

  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const toggleFullscreen = () => {
    const element = document.documentElement;
    if (!element) return;
    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleReserveAlert = (program: Program) => {
    const isReserved = reservedAlerts.some(
      a => a.channelId === activeChannel.id && a.program.startTime === program.startTime
    );
    let updated;
    if (isReserved) {
      updated = reservedAlerts.filter(
        a => !(a.channelId === activeChannel.id && a.program.startTime === program.startTime)
      );
    } else {
      updated = [...reservedAlerts, {
        channelId: activeChannel.id,
        channelName: activeChannel.name,
        program
      }];
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
    setReservedAlerts(updated);
    localStorage.setItem('tv-alerts', JSON.stringify(updated));
  };

  // 모바일 터치 제스처
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartX.current = touch.clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    const deltaY = touchStartY.current - touch.clientY;
    const container = playerContainerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const isLeftSide = touchStartX.current < width / 2;

    if (isLeftSide) {
      const change = deltaY / 300;
      setBrightness(prev => {
        const val = Math.min(1.5, Math.max(0.2, prev + change));
        setTouchIndicator({ show: true, type: 'brightness', value: Math.round(val * 100) });
        return val;
      });
    } else {
      const change = deltaY / 300;
      setVolume(prev => {
        const val = Math.min(1.0, Math.max(0.0, prev + change));
        setIsMuted(false);
        setTouchIndicator({ show: true, type: 'volume', value: Math.round(val * 100) });
        return val;
      });
    }
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    setTimeout(() => {
      setTouchIndicator(prev => ({ ...prev, show: false }));
    }, 1200);
  };

  // 내장 M3U 파일 로드
  const handleLoadPreloadedM3u = async () => {
    setIsLoadingM3u(true);
    setM3uFileName('World 2025.m3u');
    try {
      const response = await fetch('/World 2025.m3u');
      if (!response.ok) {
        throw new Error('M3U 파일을 불러오는데 실패했습니다.');
      }
      const text = await response.text();
      const parsed = parseM3U(text);
      setM3uChannels(parsed);
      setSelectedCategory('M3U 방송');
      setSelectedM3uGroup('전체');
      setSearchQuery('');
      setVisibleCount(60);
      if (parsed.length > 0) {
        setActiveChannel(parsed[0]);
        setIsPlaying(true);
      }
    } catch (error: any) {
      alert(`에러: ${error.message}`);
      setM3uFileName('');
    } finally {
      setIsLoadingM3u(false);
    }
  };

  // 사용자 지정 M3U 파일 업로드
  const handleUploadM3u = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingM3u(true);
    setM3uFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseM3U(text);
        setM3uChannels(parsed);
        setSelectedCategory('M3U 방송');
        setSelectedM3uGroup('전체');
        setSearchQuery('');
        setVisibleCount(60);
        if (parsed.length > 0) {
          setActiveChannel(parsed[0]);
          setIsPlaying(true);
        }
      } catch (error: any) {
        alert(`M3U 파싱 실패: ${error.message}`);
        setM3uFileName('');
      } finally {
        setIsLoadingM3u(false);
      }
    };
    reader.onerror = () => {
      alert('파일 읽기 에러가 발생했습니다.');
      setIsLoadingM3u(false);
      setM3uFileName('');
    };
    reader.readAsText(file);
  };

  // M3U 내 하위 그룹들 추출
  const m3uGroups = useMemo(() => {
    const groups = new Set<string>();
    m3uChannels.forEach(ch => {
      if (ch.groupTitle) {
        groups.add(ch.groupTitle);
      }
    });
    return ['전체', ...Array.from(groups)];
  }, [m3uChannels]);

  // 전체 채널 목록 결합 (기본 채널 + M3U 채널)
  const allChannels = useMemo(() => {
    return [...CHANNELS, ...m3uChannels];
  }, [m3uChannels]);

  // 카테고리, M3U 그룹, 검색어 통합 필터링
  const filteredChannels = useMemo(() => {
    return allChannels.filter(ch => {
      // 1. 카테고리 필터
      if (selectedCategory !== '전체') {
        if (selectedCategory === '즐겨찾기') {
          if (!bookmarks.includes(ch.id)) return false;
        } else {
          if (ch.category !== selectedCategory) return false;
        }
      }

      // 2. M3U 그룹 필터 (M3U 방송 카테고리 활성화일 때만 작동)
      if (selectedCategory === 'M3U 방송' && selectedM3uGroup !== '전체') {
        if (ch.groupTitle !== selectedM3uGroup) return false;
      }

      // 3. 검색어 필터
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesName = ch.name.toLowerCase().includes(query);
        const matchesGroup = ch.groupTitle ? ch.groupTitle.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesGroup) return false;
      }

      return true;
    });
  }, [allChannels, selectedCategory, selectedM3uGroup, bookmarks, searchQuery]);

  // 그리드 성능 유지를 위한 부분 렌더링 리스트
  const visibleChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  // 스크롤 시 자동 로딩 (M3U 채널 리스트용)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 150) {
      if (visibleCount < filteredChannels.length) {
        setVisibleCount(prev => Math.min(filteredChannels.length, prev + 60));
      }
    }
  };

  return (
    <div className="app-container">
      
      {/* 1. OTT 통합 헤더 */}
      <header className="ott-header">
        <div className="header-left">
          <div className="logo-container" onClick={() => setSelectedCategory('전체')}>
            <div className="logo-icon">
              <Tv className="w-5 h-5" />
            </div>
            <span className="logo-text">TV ON</span>
          </div>

          {/* 카테고리 풀다운(Dropdown) 메뉴 통합 */}
          <div className="dropdown-container" ref={categoryRef}>
            <button 
              onClick={() => setIsCategoryOpen(!isCategoryOpen)} 
              className={`dropdown-trigger ${isCategoryOpen ? 'active' : ''}`}
            >
              <span>{selectedCategory} 방송 목록</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {isCategoryOpen && (
              <div className="dropdown-menu left">
                {['전체', 'M3U 방송', '지상파', '인터넷 방송', '홈쇼핑 방송', '즐겨찾기'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsCategoryOpen(false);
                      setVisibleCount(60);
                    }}
                    className={`dropdown-item ${selectedCategory === cat ? 'active' : ''}`}
                  >
                    <span>{cat}</span>
                    {selectedCategory === cat && <CheckIcon />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 지상파 세부 채널선택 2차 풀다운 */}
          {selectedCategory === '지상파' && (
            <div className="dropdown-container" ref={subCategoryRef} style={{ marginLeft: '10px' }}>
              <button 
                onClick={() => setIsSubCategoryOpen(!isSubCategoryOpen)} 
                className={`dropdown-trigger ${isSubCategoryOpen ? 'active' : ''}`}
                style={{ borderColor: 'var(--brand-color)' }}
              >
                <span>{activeChannel.category === '지상파' ? activeChannel.name.split(' ')[0] : '채널 선택'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {isSubCategoryOpen && (
                <div className="dropdown-menu left">
                  {CHANNELS.filter(ch => ch.category === '지상파').map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setActiveChannel(ch);
                        setIsPlaying(true);
                        setIsSubCategoryOpen(false);
                      }}
                      className={`dropdown-item ${activeChannel.id === ch.id ? 'active' : ''}`}
                    >
                      <span>{ch.name}</span>
                      {activeChannel.id === ch.id && <CheckIcon />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* M3U 그룹 선택 2차 풀다운 */}
          {selectedCategory === 'M3U 방송' && (
            <div className="dropdown-container" ref={subCategoryRef} style={{ marginLeft: '10px' }}>
              <button 
                onClick={() => setIsSubCategoryOpen(!isSubCategoryOpen)} 
                className={`dropdown-trigger ${isSubCategoryOpen ? 'active' : ''}`}
                style={{ borderColor: 'var(--brand-color)' }}
              >
                <span>{selectedM3uGroup}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {isSubCategoryOpen && (
                <div className="dropdown-menu left" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {m3uGroups.map((grp) => (
                    <button
                      key={grp}
                      onClick={() => {
                        setSelectedM3uGroup(grp);
                        setVisibleCount(60);
                        setIsSubCategoryOpen(false);
                      }}
                      className={`dropdown-item ${selectedM3uGroup === grp ? 'active' : ''}`}
                    >
                      <span>{grp}</span>
                      {selectedM3uGroup === grp && <CheckIcon />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="header-right">
          {/* 아날로그-디지털 융합 시계 */}
          <span className="header-clock">
            {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          {deferredPrompt && (
            <button onClick={handlePwaInstall} className="dropdown-trigger" style={{ borderColor: 'var(--brand-color)' }}>
              <Download className="w-4 h-4 text-red-500" />
              <span className="hidden sm:inline">앱 다운로드</span>
            </button>
          )}

          {/* 테마 버튼 */}
          <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="icon-btn"
            title={theme === 'dark' ? '라이트 테마' : '다크 테마'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-blue-500" />}
          </button>
        </div>
      </header>

      {/* 2. 메인 시네마 섹션 */}
      <main className="ott-main">
        
        {/* 비디오 및 세부 옵션 풀다운 박스 */}
        <section className="player-section">
          
          <div className="player-main-row">
            {selectedCategory === 'M3U 방송' && (
              <div 
                className="player-sidebar-list"
                onScroll={handleScroll}
              >
                {m3uChannels.length === 0 ? (
                  <div className="sidebar-empty-state">
                    <p style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>M3U 방송 채널이 없습니다.</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      하단의 [M3U 재생 관리자]를 통해 로드해 주세요.
                    </p>
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="sidebar-empty-state">
                    <p style={{ color: 'var(--text-muted)' }}>검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  visibleChannels.map((ch) => {
                    const isActive = activeChannel.id === ch.id;
                    return (
                      <div 
                        key={ch.id} 
                        className={`sidebar-channel-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setActiveChannel(ch);
                          setIsPlaying(true);
                        }}
                      >
                        {ch.name}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 플레이어 본체 */}
            <div 
              ref={playerContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="player-wrapper"
            >
              <div 
                className={`w-full h-full filter-${videoFilter}`}
                style={{ filter: `brightness(${brightness}) ${videoFilter === 'none' ? '' : videoFilter}` }}
              >
                {activeChannel.streamType === 'youtube' ? (
                  <iframe 
                    key={activeChannel.id}
                    src={activeChannel.streamUrl}
                    title={activeChannel.name}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <video 
                    ref={videoRef}
                    playsInline
                    autoPlay
                    controls={false}
                    className="video-element"
                    onClick={() => setIsPlaying(!isPlaying)}
                  ></video>
                )}
              </div>

              {/* 제스처 값 피드백 */}
              {touchIndicator.show && (
                <div className="touch-notification">
                  {touchIndicator.type === 'volume' ? <Volume2 className="w-5 h-5 text-red-500" /> : <Sun className="w-5 h-5 text-yellow-500" />}
                  <div>
                    <div className="touch-notification-title">{touchIndicator.type === 'volume' ? '음량 조절' : '밝기 조절'}</div>
                    <div className="touch-notification-value">{touchIndicator.value}%</div>
                  </div>
                </div>
              )}

              {/* 정지 상태 큰 플레이 아이콘 */}
              {!isPlaying && activeChannel.streamType !== 'youtube' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer" onClick={() => setIsPlaying(true)}>
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                    <Play className="w-8 h-8 fill-current ml-1" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 플레이어 하단 전용 풀다운 메뉴 및 제어바 */}
          <div className="player-controls-row">
            <div className="controls-left">
              {activeChannel.streamType !== 'youtube' && (
                <button onClick={() => setIsPlaying(!isPlaying)} className="play-pause-btn">
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
              )}

              {/* 볼륨 슬라이더 */}
              <div className="volume-control-box">
                <button onClick={() => setIsMuted(!isMuted)} className="icon-btn">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setIsMuted(false);
                  }}
                  className="volume-slider"
                />
              </div>

              {/* 시청 등급 라벨 */}
              <span className="ott-badge" style={{ position: 'static', transform: 'none' }}>
                {epgProgressInfo.program.rating === 'ALL' ? '전체관람가' : `${epgProgressInfo.program.rating}세 이상`}
              </span>

              {/* 즐겨찾기 버튼 */}
              <button 
                onClick={(e) => toggleBookmark(activeChannel.id, e)} 
                className={`icon-btn heart-btn-controls ${bookmarks.includes(activeChannel.id) ? 'active' : ''}`}
                style={{ marginLeft: '10px' }}
                title="즐겨찾기 추가/해제"
              >
                <Heart className={`w-4 h-4 ${bookmarks.includes(activeChannel.id) ? 'fill-red-600 text-red-600' : 'text-red-500'}`} />
              </button>
            </div>

            <div className="controls-right">
              {/* 풀다운 상세 설정 박스 */}
              <div className="dropdown-container" ref={settingsRef}>
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                  className={`dropdown-trigger ${isSettingsOpen ? 'active' : ''}`}
                >
                  <Settings className="w-4 h-4" />
                  <span>설정 옵션</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                
                {isSettingsOpen && (
                  <div className="dropdown-menu" style={{ minWidth: '260px' }}>
                    
                    {/* 화질 드롭다운 아이템 */}
                    <div className="dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">비디오 화질</span>
                      <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                        {['Auto', '1080p', '720p', '480p'].map(q => (
                          <button 
                            key={q} 
                            onClick={() => setQuality(q)} 
                            style={{ 
                              flex: 1, padding: '4px', fontSize: '10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                              background: quality === q ? 'var(--brand-color)' : 'transparent',
                              color: quality === q ? 'white' : 'var(--text-secondary)'
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 비디오 필터 아이템 */}
                    <div className="dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">시네마 필터</span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', width: '100%' }}>
                        {[
                          { id: 'none', label: '표준화면' },
                          { id: 'warm', label: '눈보호' },
                          { id: 'cool', label: '차가운 블루' },
                          { id: 'grayscale', label: '시네마 흑백' }
                        ].map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => setVideoFilter(f.id)}
                            style={{ 
                              padding: '4px', fontSize: '10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                              background: videoFilter === f.id ? 'var(--brand-color)' : 'transparent',
                              color: videoFilter === f.id ? 'white' : 'var(--text-secondary)'
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 수동 밝기 바 */}
                    <div className="range-slider-container">
                      <div className="range-label-row">
                        <span>화면 밝기</span>
                        <span>{Math.round(brightness * 100)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0.2"
                        max="1.5"
                        step="0.05"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="range-slider"
                      />
                    </div>

                    {/* 취침 타이머 아이템 */}
                    <div className="dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">취침 타이머</span>
                      <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                        {[
                          { l: '꺼짐', v: null },
                          { l: '10분', v: 10 },
                          { l: '30분', v: 30 },
                          { l: '60분', v: 60 }
                        ].map(t => (
                          <button 
                            key={t.l} 
                            onClick={() => setSleepTimer(t.v)} 
                            style={{ 
                              flex: 1, padding: '4px', fontSize: '10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                              background: sleepTimer === t.v ? 'var(--brand-color)' : 'transparent',
                              color: sleepTimer === t.v ? 'white' : 'var(--text-secondary)'
                            }}
                          >
                            {t.l}
                          </button>
                        ))}
                      </div>
                      {sleepTimer !== null && (
                        <span style={{ fontSize: '9px', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                          <Clock className="w-2.5 h-2.5" />
                          {sleepTimer}분 후 송출 종료
                        </span>
                      )}
                    </div>

                  </div>
                )}
              </div>

              {/* 전체화면 버튼 */}
              <button onClick={toggleFullscreen} className="icon-btn">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. 누누티비 VOD형 에피소드 아코디언 편성표 */}
          <div className="epg-accordion">
            <div 
              className="epg-accordion-header" 
              onClick={() => setIsEpgOpen(!isEpgOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock className="w-4 h-4 text-red-500" />
                <span>오늘의 에피소드 방영 일정표 보기</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{activeChannel.epg.length}개 편성</span>
                {isEpgOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
            
            <div className={`epg-accordion-content ${isEpgOpen ? 'open' : ''}`}>
              {activeChannel.epg.map((prog, idx) => {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const [startH, startM] = prog.startTime.split(':').map(Number);
                const [endH, endM] = prog.endTime.split(':').map(Number);
                const startMin = startH * 60 + startM;
                let endMin = endH * 60 + endM;
                if (endMin < startMin) endMin += 24 * 60;
                
                const isPast = currentMinutes >= endMin;
                const isCurrent = currentMinutes >= startMin && currentMinutes < endMin;
                const isReserved = reservedAlerts.some(
                  a => a.channelId === activeChannel.id && a.program.startTime === prog.startTime
                );

                return (
                  <div key={idx} className="epg-list-item" style={{ opacity: isPast ? 0.35 : 1 }}>
                    <span className="epg-item-time">{prog.startTime} ~ {prog.endTime}</span>
                    <div className="epg-item-info">
                      <div className="epg-item-title-row">
                        <span className="epg-item-title">{prog.title}</span>
                        {isCurrent && <span className="ott-badge live" style={{ position: 'static', padding: '2px 5px', fontSize: '8px' }}>방영중</span>}
                      </div>
                      <p className="epg-item-desc">{prog.description}</p>
                    </div>
                    {!isPast && (
                      <button 
                        onClick={() => toggleReserveAlert(prog)}
                        style={{ 
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: isReserved ? 'var(--warning-color)' : 'var(--text-muted)'
                        }}
                        title={isReserved ? '예약 해제' : '시청 알림 예약'}
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </section>

        {/* 4. 누누티비 썸네일 그리드 */}
        <section style={{ width: '100%' }}>
          <h2 className="ott-section-title">
            <span className="section-bullet"></span>
            <span>{selectedCategory} 방영 인기 에피소드</span>
          </h2>

          {/* M3U 업로드/로드 및 검색 제어 패널 */}
          <div className="m3u-control-panel">
            <div className="m3u-upload-section">
              <span className="m3u-panel-title">M3U 재생 관리자</span>
              <div className="m3u-buttons">
                <button 
                  onClick={handleLoadPreloadedM3u} 
                  disabled={isLoadingM3u}
                  className="m3u-btn primary-glow"
                >
                  {isLoadingM3u && m3uFileName === 'World 2025.m3u' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                      <span>로딩 중...</span>
                    </span>
                  ) : (
                    '기본 M3U 로드 (World 2025)'
                  )}
                </button>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleUploadM3u} 
                  accept=".m3u,.m3u8" 
                  style={{ display: 'none' }} 
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isLoadingM3u}
                  className="m3u-btn outline"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>M3U 파일 업로드</span>
                </button>
              </div>
              
              {m3uChannels.length > 0 && (
                <span className="m3u-status-text">
                  불러온 파일: <strong>{m3uFileName}</strong> ({m3uChannels.length.toLocaleString()}개 채널 로드 완료)
                </span>
              )}
            </div>

            <div className="m3u-search-section">
              <div className="search-input-wrapper">
                <Search className="search-icon w-4 h-4" />
                <input 
                  type="text"
                  placeholder="채널 이름 또는 그룹 검색..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(60);
                  }}
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setVisibleCount(60);
                    }} 
                    className="search-clear-btn"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {selectedCategory === 'M3U 방송' ? null : (
            <>
              <div className="ott-grid">
                {visibleChannels.map((ch) => {
                  const isActive = activeChannel.id === ch.id;
                  const epgInfo = getCurrentProgram(ch);
                  const isBookmarked = bookmarks.includes(ch.id);

                  return (
                    <div 
                      key={ch.id} 
                      className={`ott-card ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveChannel(ch);
                        setIsPlaying(true);
                      }}
                    >
                      {/* 포스터 썸네일 */}
                      <div className="ott-thumbnail-box">
                        <img 
                          src={ch.thumbnail} 
                          alt={ch.name} 
                          className="ott-thumbnail-img"
                          loading="lazy"
                        />
                        <span className="ott-badge live">LIVE</span>
                        <span className="ott-ch-number">{ch.channelNumber} CH</span>
                      </div>

                      {/* 텍스트 설명 */}
                      <div className="ott-card-info">
                        <div className="ott-card-header">
                          <span className="ott-card-name">{ch.name}</span>
                          <button 
                            onClick={(e) => toggleBookmark(ch.id, e)} 
                            className={`heart-btn ${isBookmarked ? 'active' : ''}`}
                          >
                            <Heart className="w-3.5 h-3.5 fill-current" />
                          </button>
                        </div>

                        <div className="ott-card-program">{epgInfo.program.title}</div>
                        
                        {/* 진행 바 */}
                        <div className="ott-progress-track">
                          <div 
                            className="ott-progress-bar" 
                            style={{ width: `${epgInfo.progress}%`, backgroundColor: isActive ? 'var(--brand-color)' : 'var(--accent-color)' }}
                          ></div>
                        </div>
                      </div>
                      
                      {isActive && <div className="ott-active-bar"></div>}
                    </div>
                  );
                })}
              </div>

              {filteredChannels.length > visibleCount && (
                <div className="show-more-container">
                  <button 
                    onClick={() => setVisibleCount(prev => prev + 60)} 
                    className="show-more-btn"
                  >
                    더 많은 채널 보기 ({visibleCount} / {filteredChannels.length})
                  </button>
                </div>
              )}
            </>
          )}
        </section>

      </main>

    </div>
  );
}

// 헬퍼 컴포넌트
function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
