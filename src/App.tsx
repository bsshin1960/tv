import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, 
  Sun, Moon, Heart, 
  Minimize, ChevronDown, Search, Upload, X, RefreshCw,
  Shuffle, SkipBack, SkipForward, Repeat,
  ZoomIn, ZoomOut, RotateCw, MoveHorizontal, MoveVertical
} from 'lucide-react';
import Hls from 'hls.js';
import { CHANNELS } from './data/channels';
import type { Channel, Program } from './data/channels';
import { parseM3U } from './utils/m3uParser';
// Reverted to clean 09b3e07 state (No custom bottom-sheet)
const PRELOADED_FILES = [
  { name: 'Korea.m3u', label: '한국 방송 목록' },
  { name: 'Country.m3u', label: '국가별 방송 목록' },
  { name: 'Language.m3u', label: '언어별 방송 목록' },
  { name: 'Category.m3u', label: '카테고리별 방송 목록' },
  { name: 'Adult.m3u', label: '성인 방송 목록' },
  { name: 'All_Broadcasting.m3u', label: '전체 방송 목록' },
  { name: 'World 2025.m3u', label: '월드 2025 방송 목록' }
];

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${minsStr}:${secsStr}`;
  }
  return `${minsStr}:${secsStr}`;
};

export default function App() {
  // --- 상태 관리 ---
  console.log("TV ON Reverted to 09b3e07 (Actions reset completed)");
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return localStorage.getItem('tv-last-active-channel-category') || 'M3U 방송';
  });
  const [activeChannel, setActiveChannel] = useState<Channel>(() => {
    const savedChannelId = localStorage.getItem('tv-last-active-channel-id');
    const found = CHANNELS.find(ch => ch.id === savedChannelId);
    return found || CHANNELS[0];
  });
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    const saved = localStorage.getItem('tv-bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  
  // M3U 상태 관리
  const [m3uChannels, setM3uChannels] = useState<Channel[]>([]);
  const [internetChannels, setInternetChannels] = useState<Channel[]>([]);
  const [isLoadingM3u, setIsLoadingM3u] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedM3uGroup, setSelectedM3uGroup] = useState<string>('전체');
  const [visibleCount, setVisibleCount] = useState<number>(60);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [inputFileName, setInputFileName] = useState<string>('');
  const [selectedPresetFile, setSelectedPresetFile] = useState<string>(() => {
    return localStorage.getItem('tv-selected-preset') || 'Korea.m3u';
  });
  const [isCustomInput, setIsCustomInput] = useState<boolean>(false);
  
  // 비디오 제어
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  
  // 드롭다운 및 아코디언 토글 상태 (풀다운 메뉴 개편 핵심)
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [isSubCategoryOpen, setIsSubCategoryOpen] = useState<boolean>(false);
  
  // 예약 알림 및 타이머
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const [reservedAlerts, setReservedAlerts] = useState<{channelId: string, channelName: string, program: Program}[]>(() => {
    const saved = localStorage.getItem('tv-alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [touchIndicator, setTouchIndicator] = useState<{ show: boolean, type: 'volume' | 'brightness', value: number }>({
    show: false,
    type: 'volume',
    value: 0
  });
  const [streamError, setStreamError] = useState<string | null>(null);

  // 비디오 진행바 관련 상태
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isHoveringPanel, setIsHoveringPanel] = useState<boolean>(false);
  const [isTouchActive, setIsTouchActive] = useState<boolean>(false);
  const touchTimeoutRef = useRef<any>(null);
  const mouseTimeoutRef = useRef<any>(null);

  const refreshTouchActive = () => {
    setIsTouchActive(true);
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
    touchTimeoutRef.current = setTimeout(() => {
      setIsTouchActive(false);
    }, 3000);
  };

  const refreshMouseHover = () => {
    setIsHovered(true);
    if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    mouseTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 3000);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    handleMouseUpOrLeave();
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setVideoCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, []);

  // 줌, 화면 회전 및 화면 이동 상태 관리
  const [scaleX, setScaleX] = useState<number>(1.0);
  const [scaleY, setScaleY] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoomIndicator, setZoomIndicator] = useState<{ show: boolean, text: string }>({
    show: false,
    text: '100%'
  });
  const zoomTimeoutRef = useRef<any>(null);

  // 마우스 드래그를 통한 화면 이동 상태
  const [isMouseDragging, setIsMouseDragging] = useState<boolean>(false);
  const isMouseDraggingRef = useRef<boolean>(false);
  const mouseStartPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const initialPanOffsetRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const draggedRef = useRef<boolean>(false);
  const isScrubbingRef = useRef<boolean>(false);

  const showZoomFeedback = (sX: number, sY: number) => {
    const valX = Math.round(sX * 100);
    const valY = Math.round(sY * 100);
    const text = valX === valY ? `${valX}%` : `좌우 ${valX}% / 상하 ${valY}%`;
    setZoomIndicator({ show: true, text });
  };

  const showRotationFeedback = (deg: number) => {
    setZoomIndicator({ show: true, text: `회전 ${deg}°` });
  };

  // 화면 배율 초기화 플로팅 버튼 상태 및 트리거
  const [showResetOverlay, setShowResetOverlay] = useState<boolean>(false);
  const resetOverlayTimeoutRef = useRef<any>(null);

  // 랜덤 재생 모드 상태
  const [isShuffleMode, setIsShuffleMode] = useState<boolean>(false);
  // 반복 재생 모드 상태
  const [isLoopMode, setIsLoopMode] = useState<boolean>(false);

  const triggerResetOverlay = () => {
    setShowResetOverlay(true);
    if (resetOverlayTimeoutRef.current) clearTimeout(resetOverlayTimeoutRef.current);
    resetOverlayTimeoutRef.current = setTimeout(() => {
      setShowResetOverlay(false);
    }, 4000); // 4초간 미터치 시 사라짐
  };

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const initialPinchDistanceRef = useRef<number>(0);
  const initialScaleXRef = useRef<number>(1.0);
  const initialScaleYRef = useRef<number>(1.0);
  const touchStartMidpointRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const initialDxRef = useRef<number>(0);
  const initialDyRef = useRef<number>(0);
  const pinchModeRef = useRef<'all' | 'x' | 'y'>('all');
  
  // 드롭다운 외부 클릭 시 닫기용 Ref
  const categoryRef = useRef<HTMLDivElement>(null);
  const subCategoryRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleVideoEndedRef = useRef<() => void>(() => {});

  // --- 이펙트 ---
  
  // 화면 배율/회전 피드백 표시 자동 숨김 이펙트
  useEffect(() => {
    if (!zoomIndicator.show) return;

    const timer = setTimeout(() => {
      setZoomIndicator(prev => ({ ...prev, show: false }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [zoomIndicator.show, zoomIndicator.text]);

  // 실시간 비디오 프레임을 캔버스에 그리는 렌더링 루프 (모바일 우클릭/롱프레스 다운로드 방지)
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      // 비디오가 데이터를 가지고 재생 가능한 상태일 때 그림
      if (videoElement.readyState >= 2) {
        if (canvas.width !== videoElement.videoWidth || canvas.height !== videoElement.videoHeight) {
          canvas.width = videoElement.videoWidth || 640;
          canvas.height = videoElement.videoHeight || 360;
        }
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      }
      animationFrameId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [videoElement, activeChannel, isLoadingM3u]);

  // Shadow DOM 내부에 <video> 엘리먼트를 격리 — 안드로이드 브라우저가 DOM 탐색으로 video 태그를
  // 감지하지 못하도록 완벽히 차단. Shadow DOM은 일반 Light DOM과 분리되어 있어
  // 브라우저의 미디어 컨텍스트 메뉴 탐색 로직이 진입 불가능.
  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host) return;

    // 이미 Shadow Root가 부착되어 있으면 재사용
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

    // 기존 video 제거
    while (shadow.firstChild) shadow.removeChild(shadow.firstChild);

    const video = document.createElement('video');
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('controlsList', 'nodownload');
    video.setAttribute('disablePictureInPicture', '');
    video.setAttribute('disableRemotePlayback', '');
    video.style.cssText = [
      'position:absolute',
      'left:-99999px',
      'top:-99999px',
      'width:1px',
      'height:1px',
      'opacity:0',
      'pointer-events:none',
    ].join(';');
    video.addEventListener('contextmenu', (e) => e.preventDefault());

    // 비디오 이벤트를 React state 업데이트에 연결
    video.addEventListener('timeupdate', () => {
      if (!isScrubbingRef.current) {
        setVideoCurrentTime(video.currentTime);
      }
    });
    video.addEventListener('loadedmetadata', () => {
      setVideoDuration(video.duration);
    });
    video.addEventListener('durationchange', () => {
      setVideoDuration(video.duration);
    });
    video.addEventListener('ended', () => {
      handleVideoEndedRef.current();
    });
    video.addEventListener('error', () => {
      const err = video.error;
      if (err && err.code !== 1) {
        setStreamError('동영상 스트림 로드 실패 (차단되었거나 오프라인)');
      }
    });

    shadow.appendChild(video);

    // videoRef 및 videoElement state 업데이트
    videoRef.current = video;
    setVideoElement(video);

    return () => {
      // cleanup: video 제거
      try { shadow.removeChild(video); } catch (_) { /* ignore */ }
      videoRef.current = null;
      setVideoElement(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // 1. 실시간 시계 & 타이머 & 예약 알림 체크
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      


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

  // 시작 시 이전에 선택한 M3U 파일 자동 로딩
  useEffect(() => {
    const savedPreset = localStorage.getItem('tv-selected-preset') || 'Korea.m3u';
    loadM3uFile(savedPreset);
  }, []);

  // 시작 시 Internet.txt 파일 동적 로딩 및 파싱
  useEffect(() => {
    const loadInternetTxt = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}Internet.txt`);
        if (!response.ok) {
          throw new Error('Internet.txt 로드 실패');
        }
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        const parsed: Channel[] = [];
        let index = 0;
        for (const line of lines) {
          if (!line.trim()) continue;
          const commaIdx = line.indexOf(',');
          if (commaIdx === -1) continue;
          const name = line.substring(0, commaIdx).trim();
          const url = line.substring(commaIdx + 1).trim();
          if (!name || !url) continue;

          let streamType: 'hls' | 'mp4' | 'youtube' | 'iframe' = 'iframe';
          if (url.includes('.m3u8')) {
            streamType = 'hls';
          } else if (url.includes('.mp4')) {
            streamType = 'mp4';
          } else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube.com/embed/')) {
            streamType = 'youtube';
          }

          let finalUrl = url;
          if (streamType === 'youtube') {
            let videoId = '';
            if (url.includes('v=')) {
              videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('embed/')) {
              videoId = url.split('embed/')[1].split('?')[0];
            } else if (url.includes('youtu.be/')) {
              videoId = url.split('youtu.be/')[1].split('?')[0];
            } else if (url.includes('youtube.com/watch/')) {
              videoId = url.split('youtube.com/watch/')[1].split('?')[0];
            }
            if (videoId) {
              finalUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
            }
          }

          parsed.push({
            id: `internet-txt-${index}`,
            channelNumber: 500 + index,
            name,
            category: '인터넷 방송',
            logo: '🌐',
            thumbnail: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&auto=format&fit=crop&q=80',
            streamUrl: finalUrl,
            streamType,
            epg: [
              { startTime: '00:00', endTime: '24:00', title: `${name} 실시간 방송`, description: `${name}에서 제공하는 인터넷 실시간 방송입니다.`, rating: 'ALL' }
            ]
          });
          index++;
        }
        setInternetChannels(parsed);
      } catch (err) {
        console.error('인터넷 채널 로드 실패:', err);
      }
    };
    loadInternetTxt();
  }, []);

  // 마지막 시청 채널 및 카테고리 상태 저장
  useEffect(() => {
    if (activeChannel && activeChannel.id) {
      localStorage.setItem('tv-last-active-channel-id', activeChannel.id);
      localStorage.setItem('tv-last-active-channel-category', selectedCategory);
    }
  }, [activeChannel, selectedCategory]);

  // 2. 외부 영역 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (subCategoryRef.current && !subCategoryRef.current.contains(e.target as Node)) {
        setIsSubCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 3. 비디오 채널 스트림 전환
  useEffect(() => {
    setStreamError(null);
    setScaleX(1.0);
    setScaleY(1.0);
    setRotation(0);
    setPanOffset({ x: 0, y: 0 });
    setVideoCurrentTime(0);
    setVideoDuration(0);

    if (isLoadingM3u) return;

    if (activeChannel.streamType === 'youtube' || activeChannel.streamType === 'iframe') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    if (!videoElement) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let active = true;
    let canPlayListener: (() => void) | null = null;

    if (activeChannel.streamType === 'hls') {
      if (Hls.isSupported()) {
        let fatalRetryCount = 0;
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(activeChannel.streamUrl);
        hls.attachMedia(videoElement);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStreamError(null);
          if (isPlaying && active) {
            videoElement.play().catch((err) => {
              if (err.name !== 'AbortError' && active) {
                setIsPlaying(false);
              }
            });
          }
        });
        hls.on(Hls.Events.ERROR, function (_, data) {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                fatalRetryCount++;
                if (fatalRetryCount > 3) {
                  setStreamError('방송 스트림 연결 실패 (오프라인 상태이거나 국내 네트워크 차단)');
                  hls.destroy();
                } else {
                  hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setStreamError('재생할 수 없는 스트림 데이터 형식입니다.');
                hls.destroy();
                break;
            }
          }
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        let isSameSrc = false;
        try {
          const absoluteTarget = new URL(activeChannel.streamUrl, window.location.href).href;
          isSameSrc = (videoElement.src === absoluteTarget);
        } catch (_) {
          isSameSrc = (videoElement.src === activeChannel.streamUrl);
        }

        if (!isSameSrc) {
          videoElement.src = activeChannel.streamUrl;
        }

        const handleHlsMetadata = () => {
          setStreamError(null);
          if (isPlaying && active) {
            videoElement.play().catch((err) => {
              if (err.name !== 'AbortError' && active) {
                setIsPlaying(false);
              }
            });
          }
        };

        if (isSameSrc && videoElement.readyState >= 1) {
          handleHlsMetadata();
        } else {
          videoElement.addEventListener('loadedmetadata', handleHlsMetadata, { once: true });
        }
      }
    } else {
      let isSameSrc = false;
      try {
        const absoluteTarget = new URL(activeChannel.streamUrl, window.location.href).href;
        isSameSrc = (videoElement.src === absoluteTarget);
      } catch (_) {
        isSameSrc = (videoElement.src === activeChannel.streamUrl);
      }

      if (!isSameSrc) {
        videoElement.src = activeChannel.streamUrl;
        videoElement.load();
      }

      const handleCanPlay = () => {
        if (!active) return;
        if (isPlaying) {
          videoElement.play().catch((err) => {
            if (err.name !== 'AbortError' && active) {
              setIsPlaying(false);
            }
          });
        }
      };

      if (isSameSrc && videoElement.readyState >= 2) {
        handleCanPlay();
      } else {
        videoElement.addEventListener('canplay', handleCanPlay, { once: true });
        canPlayListener = handleCanPlay;
      }
    }

    return () => {
      active = false;
      if (canPlayListener && videoElement) {
        videoElement.removeEventListener('canplay', canPlayListener);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoElement, activeChannel, isLoadingM3u]);

  // 4. 비디오 재생/정지 제어
  useEffect(() => {
    if (!videoElement || activeChannel.streamType === 'youtube' || activeChannel.streamType === 'iframe') return;
    if (isPlaying) {
      videoElement.play().catch(() => setIsPlaying(false));
    } else {
      videoElement.pause();
    }
  }, [videoElement, isPlaying, activeChannel]);

  // 5. 볼륨 제어
  useEffect(() => {
    if (!videoElement) return;
    videoElement.volume = isMuted ? 0 : volume;
  }, [videoElement, volume, isMuted]);

  // 반복 재생 모드 적용
  useEffect(() => {
    if (!videoElement) return;
    videoElement.loop = isLoopMode;
  }, [videoElement, isLoopMode]);

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

  // 8. 마우스 휠 스크롤을 통한 화면 50% ~ 300% 확대/축소
  useEffect(() => {
    const playerWrapper = playerContainerRef.current;
    if (!playerWrapper) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const newX = Math.min(3.0, Math.max(0.5, scaleX + delta));
      const newY = Math.min(3.0, Math.max(0.5, scaleY + delta));
      setScaleX(newX);
      setScaleY(newY);
      showZoomFeedback(newX, newY);
    };

    playerWrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      playerWrapper.removeEventListener('wheel', handleWheel);
    };
  }, [scaleX, scaleY, isLoadingM3u]);

  // 9. 키보드 단축키를 통한 화면 확대/축소 및 방향키를 통한 화면 이동
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') {
        return;
      }

      // 대칭 줌 ( + / - / 0 / r )
      if (e.key === '+' || e.key === '=' || e.key === 'Add') {
        e.preventDefault();
        const newX = Math.min(3.0, Math.max(0.5, scaleX + 0.05));
        const newY = Math.min(3.0, Math.max(0.5, scaleY + 0.05));
        setScaleX(newX);
        setScaleY(newY);
        showZoomFeedback(newX, newY);
      } else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
        e.preventDefault();
        const newX = Math.min(3.0, Math.max(0.5, scaleX - 0.05));
        const newY = Math.min(3.0, Math.max(0.5, scaleY - 0.05));
        setScaleX(newX);
        setScaleY(newY);
        showZoomFeedback(newX, newY);
      } else if (e.key === '0' || e.key === 'r') {
        e.preventDefault();
        setScaleX(1.0);
        setScaleY(1.0);
        setRotation(0);
        setPanOffset({ x: 0, y: 0 });
        showZoomFeedback(1.0, 1.0);
      } 
      // Arrow keys (Panning)
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPanOffset(prev => ({ ...prev, y: prev.y - 15 }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPanOffset(prev => ({ ...prev, y: prev.y + 15 }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPanOffset(prev => ({ ...prev, x: prev.x - 15 }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPanOffset(prev => ({ ...prev, x: prev.x + 15 }));
      }
      // Stretched zoom keys: 8, 2, 4, 6
      else if (e.key === '8') {
        // 8번: 상하 확대 (Y stretch)
        e.preventDefault();
        const newY = Math.min(3.0, scaleY + 0.05);
        setScaleY(newY);
        showZoomFeedback(scaleX, newY);
      } else if (e.key === '2') {
        // 2번: 상하 축소 (Y squish)
        e.preventDefault();
        const newY = Math.max(0.5, scaleY - 0.05);
        setScaleY(newY);
        showZoomFeedback(scaleX, newY);
      } else if (e.key === '4') {
        // 4번: 좌우 확대 (X stretch)
        e.preventDefault();
        const newX = Math.min(3.0, scaleX + 0.05);
        setScaleX(newX);
        showZoomFeedback(newX, scaleY);
      } else if (e.key === '6') {
        // 6번: 좌우 축소 (X squish)
        e.preventDefault();
        const newX = Math.max(0.5, scaleX - 0.05);
        setScaleX(newX);
        showZoomFeedback(newX, scaleY);
      }
      // Rotation key: 5
      else if (e.key === '5') {
        e.preventDefault();
        const newRotation = (rotation + 90) % 360;
        setRotation(newRotation);
        showRotationFeedback(newRotation);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scaleX, scaleY, rotation]);

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

  const toggleFullscreen = () => {
    const element = playerContainerRef.current;
    if (!element) return;
    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const lastTapRef = useRef<number>(0);
  const isPinchingRef = useRef<boolean>(false); // 두 손가락 핀치 세션 추적
  const maxTouchesRef = useRef<number>(0);     // 현재 터치 세션 중 최대 터치 개수 추적

  const handleVideoDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 모바일 터치로 인한 더블클릭 이벤트인 경우 무시 (pointerType이 'mouse'인 경우에만 전체화면 토글)
    if ((e.nativeEvent as any).pointerType && (e.nativeEvent as any).pointerType !== 'mouse') {
      return;
    }
    e.preventDefault();
    toggleFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // 모바일 및 PC 전체에서 컨텍스트 메뉴(우클릭 및 롱프레스 다운로드 팝업)를 캡처 단계에서 원천 차단
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 마우스 커서가 윈도우 밖으로 나가거나 해제될 때 드래그 오동작(붙어 다님)을 해제하는 글로벌 리스너
    const handleGlobalMouseUp = () => {
      isMouseDraggingRef.current = false;
      setIsMouseDragging(false);
      isScrubbingRef.current = false;
    };
    const handleGlobalMouseLeave = (e: MouseEvent) => {
      if (e.target === document || e.target === document.documentElement || !e.relatedTarget) {
        isMouseDraggingRef.current = false;
        setIsMouseDragging(false);
        isScrubbingRef.current = false;
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
    };
  }, []);


  // 터치 이벤트 핸들러 최신 참조 보관 Ref (Passive: false를 위한 State closure 해결)
  const handleTouchStartRef = useRef<any>(null);
  const handleTouchMoveRef = useRef<any>(null);
  const handleTouchEndRef = useRef<any>(null);

  useEffect(() => {
    handleTouchStartRef.current = handleTouchStart;
    handleTouchMoveRef.current = handleTouchMove;
    handleTouchEndRef.current = handleTouchEnd;
  }); // 매 렌더링마다 최신 핸들러 업데이트

  // 모바일 비수동 터치 리스너 직접 바인딩
  useEffect(() => {
    const element = playerContainerRef.current;
    if (!element) return;

    const onTouchStart = (e: TouchEvent) => {
      if (handleTouchStartRef.current) handleTouchStartRef.current(e);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (handleTouchMoveRef.current) handleTouchMoveRef.current(e);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (handleTouchEndRef.current) handleTouchEndRef.current(e);
    };

    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // 모바일 터치 제스처
  const handleTouchStart = (e: React.TouchEvent) => {
    refreshTouchActive();
    triggerResetOverlay();

    // 현재 터치 세션의 최대 터치 개수를 기록
    maxTouchesRef.current = Math.max(maxTouchesRef.current, e.touches.length);

    if (e.touches.length >= 2) {
      // 두 손가락 이상이 닿으면 핀치 세션 시작 — 더블탭 오인식 방지를 위해 타이머 리셋
      isPinchingRef.current = true;
      lastTapRef.current = 0;

      e.preventDefault(); // 기본 브라우저 핀치 줌 및 확대 해제 차단
      // 두 손가락 터치 시 핀치 줌 & 드래그 이동 시작
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      initialPinchDistanceRef.current = dist;
      initialScaleXRef.current = scaleX;
      initialScaleYRef.current = scaleY;
      initialDxRef.current = Math.abs(dx);
      initialDyRef.current = Math.abs(dy);

      // 두 손가락 정렬 각도 계산 (0 ~ 180도) -> [0, 90] 범위로 정규화
      const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      const angleNormalized = angle > 90 ? 180 - angle : angle;
      if (angleNormalized < 30) {
        pinchModeRef.current = 'x'; // 가로 눕혀 터치 -> 좌우 줌만 활성화
      } else if (angleNormalized > 60) {
        pinchModeRef.current = 'y'; // 세로 세워 터치 -> 상하 줌만 활성화
      } else {
        pinchModeRef.current = 'all'; // 대각선 터치 -> 대칭 줌 활성화
      }

      // 두 손가락 중간점 좌표 기록
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      touchStartMidpointRef.current = { x: midX, y: midY };
      initialPanOffsetRef.current = { x: panOffset.x, y: panOffset.y };

      isDragging.current = false; // 한 손가락 볼륨/밝기 이동 차단

    } else if (e.touches.length === 1) {
      // 한 손가락 터치 시 기존 밝기/볼륨 조절 및 패닝 대기
      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      isDragging.current = true;

      // 화면이 확대된 상태라면, 한 손가락으로 화면을 끌어다 이동(Panning)할 수 있도록 초기 좌표 설정
      if (scaleX > 1.0 || scaleY > 1.0) {
        initialPanOffsetRef.current = { x: panOffset.x, y: panOffset.y };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    refreshTouchActive();
    maxTouchesRef.current = Math.max(maxTouchesRef.current, e.touches.length);

    if (e.touches.length === 2) {
      e.preventDefault(); // 기본 브라우저 핀치 줌 및 확대 해제 차단
      // 두 손가락 드래그 시 핀치 줌 & 화면 이동(Pan) 동시 적용
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (pinchModeRef.current === 'x') {
        if (initialDxRef.current > 10) {
          const factor = Math.abs(dx) / initialDxRef.current;
          if (!isNaN(factor) && isFinite(factor)) {
            const newScaleX = Math.min(3.0, Math.max(0.5, initialScaleXRef.current * factor));
            setScaleX(newScaleX);
            showZoomFeedback(newScaleX, initialScaleYRef.current);
          }
        }
      } else if (pinchModeRef.current === 'y') {
        if (initialDyRef.current > 10) {
          const factor = Math.abs(dy) / initialDyRef.current;
          if (!isNaN(factor) && isFinite(factor)) {
            const newScaleY = Math.min(3.0, Math.max(0.5, initialScaleYRef.current * factor));
            setScaleY(newScaleY);
            showZoomFeedback(initialScaleXRef.current, newScaleY);
          }
        }
      } else {
        if (initialPinchDistanceRef.current > 10) {
          const factor = dist / initialPinchDistanceRef.current;
          if (!isNaN(factor) && isFinite(factor)) {
            const newScaleX = Math.min(3.0, Math.max(0.5, initialScaleXRef.current * factor));
            const newScaleY = Math.min(3.0, Math.max(0.5, initialScaleYRef.current * factor));
            setScaleX(newScaleX);
            setScaleY(newScaleY);
            showZoomFeedback(newScaleX, newScaleY);
          }
        }
      }

      // 중심점 변화량을 바탕으로 화면 이동(Pan) 좌표 업데이트
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const deltaX = midX - touchStartMidpointRef.current.x;
      const deltaY = midY - touchStartMidpointRef.current.y;
      if (!isNaN(deltaX) && isFinite(deltaX) && !isNaN(deltaY) && isFinite(deltaY)) {
        setPanOffset({
          x: initialPanOffsetRef.current.x + deltaX,
          y: initialPanOffsetRef.current.y + deltaY
        });
      }
    } else if (e.touches.length === 1 && isDragging.current) {
      // 한 손가락 드래그 시 볼륨/밝기 조절 또는 화면 이동(Pan)
      const touch = e.touches[0];
      const isZoomed = scaleX > 1.0 || scaleY > 1.0;

      if (isZoomed) {
        e.preventDefault(); // 스크롤/바운스 효과 차단
        // 화면이 확대된 상태이면 화면 이동(Panning) 처리
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = touch.clientY - touchStartY.current;
        if (!isNaN(deltaX) && isFinite(deltaX) && !isNaN(deltaY) && isFinite(deltaY)) {
          setPanOffset({
            x: initialPanOffsetRef.current.x + deltaX,
            y: initialPanOffsetRef.current.y + deltaY
          });
        }
      } else {
        e.preventDefault(); // 스크롤/바운스 효과 차단
        // 화면이 기본 상태이면 기존 볼륨/밝기 조절
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
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    isScrubbingRef.current = false;
    refreshTouchActive();
    isDragging.current = false;
    initialPinchDistanceRef.current = 0;
    initialDxRef.current = 0;
    initialDyRef.current = 0;
    pinchModeRef.current = 'all';

    // 모든 손가락이 화면에서 완전히 떨어졌을 때만 제스처 종료 및 클릭/더블탭 판단
    if (e.touches.length === 0) {
      // 핀치 확대 동작을 전혀 하지 않았고, 순수하게 1인 터치 세션이었을 때만 더블탭 감지 수행
      if (maxTouchesRef.current === 1 && !isPinchingRef.current) {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
          e.preventDefault();
          lastTapRef.current = 0; // 즉시 리셋하여 연속 오동작 차단
          toggleFullscreen();
        } else {
          lastTapRef.current = now;
        }
      }

      // 다음 터치 세션을 위해 초기화
      isPinchingRef.current = false;
      maxTouchesRef.current = 0;
    }
    
    // 손가락을 화면에서 때면 즉시 배율 조절 % 표시 창 제거
    setZoomIndicator(prev => ({ ...prev, show: false }));
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);

    setTimeout(() => {
      setTouchIndicator(prev => ({ ...prev, show: false }));
    }, 1200);
  };


  // 마우스 드래그를 통한 화면 이동
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    triggerResetOverlay();
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.player-controls-row')) {
      return;
    }

    isMouseDraggingRef.current = true;
    setIsMouseDragging(true);
    draggedRef.current = false;
    mouseStartPosRef.current = { x: e.clientX, y: e.clientY };
    initialPanOffsetRef.current = { x: panOffset.x, y: panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    refreshMouseHover();
    if (!isMouseDraggingRef.current) return;

    const deltaX = e.clientX - mouseStartPosRef.current.x;
    const deltaY = e.clientY - mouseStartPosRef.current.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      draggedRef.current = true;
    }

    setPanOffset({
      x: initialPanOffsetRef.current.x + deltaX,
      y: initialPanOffsetRef.current.y + deltaY
    });
  };

  const handleMouseUpOrLeave = () => {
    isScrubbingRef.current = false;
    if (isMouseDraggingRef.current) {
      isMouseDraggingRef.current = false;
      setIsMouseDragging(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    triggerResetOverlay();
    // deltaY < 0 indicates scroll up, deltaY > 0 indicates scroll down
    const factor = e.deltaY < 0 ? 0.05 : -0.05;
    
    setScaleX(prevX => {
      const newX = Math.min(3.0, Math.max(0.5, prevX + factor));
      setScaleY(prevY => {
        const newY = Math.min(3.0, Math.max(0.5, prevY + factor));
        showZoomFeedback(newX, newY);
        return newY;
      });
      return newX;
    });
  };

  // 내장 M3U 파일 공통 로드 함수
  const loadM3uFile = async (fileName: string) => {
    setIsLoadingM3u(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${fileName}`);
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

      setSelectedPresetFile(fileName);
      localStorage.setItem('tv-selected-preset', fileName);

      if (parsed.length > 0) {
        // 프리셋이 로드되면 기본적으로 첫 번째 채널을 설정하되,
        // 한국 방송 목록(Korea.m3u)인 경우 'EBS E' 채널을 찾아 기본으로 설정합니다.
        let defaultChannel = parsed[0];
        if (fileName === 'Korea.m3u') {
          const ebsE = parsed.find(ch => ch.name.includes('EBS E'));
          if (ebsE) {
            defaultChannel = ebsE;
          }
        }
        setActiveChannel(defaultChannel);
        setIsPlaying(true);
      }
    } catch (error: any) {
      alert(`에러: ${error.message}`);
    } finally {
      setIsLoadingM3u(false);
    }
  };

  // 사용자 지정 파일 불러오기 또는 기기 파일 탐색기 fallback
  const handleLoadFromPublic = async () => {
    if (!inputFileName.trim()) {
      setIsUploadModalOpen(false);
      fileInputRef.current?.click();
      return;
    }
    
    let targetFile = inputFileName.trim();
    if (!targetFile.endsWith('.m3u') && !targetFile.endsWith('.m3u8')) {
      targetFile += '.m3u';
    }

    setIsLoadingM3u(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${targetFile}`);
      if (!response.ok) {
        throw new Error('파일이 public 폴더에 존재하지 않습니다.');
      }
      const text = await response.text();
      const parsed = parseM3U(text);
      setM3uChannels(parsed);
      setSelectedCategory('M3U 방송');
      setSelectedM3uGroup('전체');
      setSearchQuery('');
      setVisibleCount(60);

      setSelectedPresetFile(targetFile);
      localStorage.setItem('tv-selected-preset', targetFile);

      if (parsed.length > 0) {
        // 프리셋이 로드되면 항상 첫 번째 채널을 자동 재생
        setActiveChannel(parsed[0]);
        setIsPlaying(true);
      }
      setIsUploadModalOpen(false);
    } catch (error: any) {
      alert(`[public 로드 실패] ${error.message}\n기기 내 폴더 탐색기를 엽니다.`);
      setIsUploadModalOpen(false);
      // Fallback: 기기 파일 탐색기 트리거
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    } finally {
      setIsLoadingM3u(false);
    }
  };

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
    const savedPreset = localStorage.getItem('tv-selected-preset') || 'Korea.m3u';
    
    // 저장된 프리셋이 내장 프리셋인지 여부 확인
    const isPresetExist = PRELOADED_FILES.some(f => f.name === savedPreset);
    if (isPresetExist) {
      setSelectedPresetFile(savedPreset);
      setInputFileName(savedPreset);
      setIsCustomInput(false);
    } else {
      setSelectedPresetFile('custom');
      setInputFileName(savedPreset);
      setIsCustomInput(true);
    }
  };

  const handlePresetSelect = (fileName: string) => {
    setSelectedPresetFile(fileName);
    if (fileName === 'custom') {
      setIsCustomInput(true);
      setInputFileName('');
    } else {
      setIsCustomInput(false);
      setInputFileName(fileName);
      loadM3uFile(fileName).then(() => {
        setIsUploadModalOpen(false);
      });
    }
  };

  // 사용자 지정 M3U / 동영상 파일/폴더 업로드
  const handleUploadM3u = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoadingM3u(true);

    // 동영상 파일 필터링
    const videoFiles = Array.from(files).filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.mp4') || name.endsWith('.mkv') || name.endsWith('.avi') || name.endsWith('.mov') || name.endsWith('.webm') || name.endsWith('.m4v');
    });

    if (videoFiles.length > 0) {
      try {
        // 파일명을 숫자가 인식되는 자연스러운 정렬 순서로 정렬 (예: ep1, ep2, ep10...)
        const sortedFiles = videoFiles.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        const localVideoChannels: Channel[] = sortedFiles.map((file, index) => {
          const fileUrl = URL.createObjectURL(file);
          return {
            id: `local-mp4-${file.name}-${index}`,
            channelNumber: 9999 + index,
            name: file.name.replace(/\.[^/.]+$/, ""), // 확장자 제거
            category: 'M3U 방송',
            logo: '🎞️',
            thumbnail: 'https://images.unsplash.com/photo-1461151304267-38cd890855f1?w=500&auto=format&fit=crop&q=80',
            streamUrl: fileUrl,
            streamType: 'mp4',
            epg: [
              { startTime: '00:00', endTime: '24:00', title: file.name, description: '기기에서 직접 재생하는 로컬 동영상 파일입니다.', rating: 'ALL' }
            ],
            isM3u: true
          };
        });

        setM3uChannels(localVideoChannels);
        setSelectedCategory('M3U 방송');
        setSelectedM3uGroup('전체');
        setSearchQuery('');
        setVisibleCount(60);

        if (localVideoChannels.length > 0) {
          setActiveChannel(localVideoChannels[0]);
          setIsPlaying(true);
        }
      } catch (error: any) {
        alert(`동영상 로드 실패: ${error.message}`);
      } finally {
        setIsLoadingM3u(false);
      }
      return;
    }

    // 재생 가능한 비디오 파일이 없으면 M3U 파일 탐색
    const m3uFiles = Array.from(files).filter(file => {
      const name = file.name.toLowerCase();
      return name.endsWith('.m3u') || name.endsWith('.m3u8');
    });

    if (m3uFiles.length > 0) {
      const file = m3uFiles[0];
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
        } finally {
          setIsLoadingM3u(false);
        }
      };
      reader.onerror = () => {
        alert('파일 읽기 에러가 발생했습니다.');
        setIsLoadingM3u(false);
      };
      reader.readAsText(file);
      return;
    }

    alert('재생 가능한 동영상 파일(.mp4, .mkv 등) 또는 M3U 파일이 없습니다.');
    setIsLoadingM3u(false);
  };

  // 영상 종료 시 다음 영상 자동 재생 핸들러
  const handleVideoEnded = () => {
    if (isLoopMode) {
      if (videoElement) {
        videoElement.currentTime = 0;
        videoElement.play().catch(console.error);
      }
      setIsPlaying(true);
      return;
    }

    let nextChannel: Channel | null = null;

    if (isShuffleMode && filteredChannels.length > 1) {
      let randomIndex = Math.floor(Math.random() * filteredChannels.length);
      const currentIdx = filteredChannels.findIndex(ch => ch.id === activeChannel.id);
      if (randomIndex === currentIdx && filteredChannels.length > 1) {
        randomIndex = (randomIndex + 1) % filteredChannels.length;
      }
      nextChannel = filteredChannels[randomIndex];
    } else {
      const currentIndex = filteredChannels.findIndex(ch => ch.id === activeChannel.id);
      if (currentIndex !== -1 && filteredChannels.length > 0) {
        const nextIndex = (currentIndex + 1) % filteredChannels.length;
        nextChannel = filteredChannels[nextIndex];
      }
    }

    if (nextChannel) {
      setActiveChannel(nextChannel);
      setIsPlaying(true);

      // 모바일 자동 재생 우회를 위해 동기적으로 src 로드 및 재생
      if (videoElement && nextChannel.streamType !== 'youtube') {
        const isNativeHls = nextChannel.streamType === 'hls' && !Hls.isSupported() && videoElement.canPlayType('application/vnd.apple.mpegurl');
        if (nextChannel.streamType === 'mp4' || isNativeHls) {
          videoElement.src = nextChannel.streamUrl;
          videoElement.load();
          videoElement.play().catch((err) => {
            console.log("동기 자동 재생 실패, 비동기 처리를 대기합니다:", err);
          });
        }
      }
    }
  };

  useEffect(() => {
    handleVideoEndedRef.current = handleVideoEnded;
  }, [handleVideoEnded]);

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

  // 전체 채널 목록 결합 (기본 채널 + M3U 채널 + 인터넷 동적 채널)
  const allChannels = useMemo(() => {
    return [...CHANNELS, ...m3uChannels, ...internetChannels];
  }, [m3uChannels, internetChannels]);

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

  // 이전/다음 영상 네비게이션 인덱스 및 핸들러 정의
  const currentIndex = useMemo(() => {
    return filteredChannels.findIndex(ch => ch.id === activeChannel.id);
  }, [filteredChannels, activeChannel]);

  const hasPreviousChannel = currentIndex > 0;
  const hasNextChannel = currentIndex !== -1 && currentIndex + 1 < filteredChannels.length;

  const handlePlayPrevious = () => {
    if (isShuffleMode && filteredChannels.length > 1) {
      let randomIndex = Math.floor(Math.random() * filteredChannels.length);
      const currentIdx = filteredChannels.findIndex(ch => ch.id === activeChannel.id);
      if (randomIndex === currentIdx && filteredChannels.length > 1) {
        randomIndex = (randomIndex + 1) % filteredChannels.length;
      }
      const prevChannel = filteredChannels[randomIndex];
      setActiveChannel(prevChannel);
      setIsPlaying(true);
    } else if (hasPreviousChannel) {
      const prevChannel = filteredChannels[currentIndex - 1];
      setActiveChannel(prevChannel);
      setIsPlaying(true);
    }
  };

  const handlePlayNext = () => {
    if (isShuffleMode && filteredChannels.length > 1) {
      let randomIndex = Math.floor(Math.random() * filteredChannels.length);
      const currentIdx = filteredChannels.findIndex(ch => ch.id === activeChannel.id);
      if (randomIndex === currentIdx && filteredChannels.length > 1) {
        randomIndex = (randomIndex + 1) % filteredChannels.length;
      }
      const nextChannel = filteredChannels[randomIndex];
      setActiveChannel(nextChannel);
      setIsPlaying(true);
    } else if (hasNextChannel) {
      const nextChannel = filteredChannels[currentIndex + 1];
      setActiveChannel(nextChannel);
      setIsPlaying(true);
    }
  };

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
          {/* 카테고리 풀다운(Dropdown) 메뉴 통합 */}
          <div className="dropdown-container" ref={categoryRef}>
            <button 
              onClick={() => setIsCategoryOpen(!isCategoryOpen)} 
              className={`dropdown-trigger ${isCategoryOpen ? 'active' : ''}`}
            >
              <span>{selectedCategory}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {isCategoryOpen && (
              <div className="dropdown-menu left">
                {['전체', 'M3U 방송', '인터넷 방송', '지상파', '홈쇼핑 방송', '즐겨찾기'].map((cat) => (
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

          {/* M3U 로드 / 업로드 버튼 추가 (그룹 선택 박스 오른쪽) */}
          {selectedCategory === 'M3U 방송' && (
            <div className="m3u-header-buttons" style={{ display: 'flex', gap: '8px', marginLeft: '10px', alignItems: 'center' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUploadM3u} 
                accept="video/*,.m3u,.m3u8"
                multiple
                style={{ display: 'none' }} 
              />
              
              <button 
                onClick={handleUploadClick} 
                disabled={isLoadingM3u}
                className="m3u-btn outline"
                style={{ padding: '6px 12px', fontSize: '13px', height: '34px', display: 'flex', alignItems: 'center', gap: '12px', lineHeight: '1', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <span className="hidden-mobile">기기 파일 불러오기</span>
                <span className="visible-mobile">불러오기</span>
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="header-right">


          {/* 아날로그-디지털 융합 시계 */}
          <span className="header-clock hidden-mobile">
            {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

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
            <div className="player-sidebar-list">
              {/* Sidebar 검색창 */}
              <div className="sidebar-search-box">
                <Search className="sidebar-search-icon w-4 h-4" />
                <input 
                  type="text"
                  placeholder="채널 검색..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(60);
                  }}
                  className="sidebar-search-input"
                />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setVisibleCount(60);
                    }} 
                    className="sidebar-search-clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 스크롤 가능한 채널 리스트 영역 */}
              <div 
                className="sidebar-channels-scroll"
                onScroll={handleScroll}
              >
                {selectedCategory === 'M3U 방송' && m3uChannels.length === 0 ? (
                  <div className="sidebar-empty-state">
                    <p style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>M3U 방송 채널이 없습니다.</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      상단 [기본 M3U 로드] 또는 [M3U 파일 업로드]를 통해 로드해 주세요.
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
            </div>

            {/* 플레이어 본체 */}
            <div 
              ref={playerContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={refreshMouseHover}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()} // 모바일 롱프레스 및 우클릭 메뉴 방지
              onClick={(e) => {
                // 클릭이 버튼이나 컨트롤바, 진행바에서 일어났다면 무시
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('input') || target.closest('.player-controls-row')) {
                  return;
                }
                
                if (draggedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  draggedRef.current = false;
                } else {
                  setIsPlaying(!isPlaying);
                }
              }}
              onDoubleClick={handleVideoDoubleClick}
              className={`player-wrapper ${isMouseDragging ? 'grabbing' : ''} ${(!isHovered && !isHoveringPanel && isPlaying) ? 'hide-cursor' : ''}`}
            >
              <div 
                style={{ 
                  width: '100%',
                  height: '100%',
                  filter: `brightness(${brightness})`,
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
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
                ) : activeChannel.streamType === 'iframe' ? (
                  <div className="w-full h-full relative flex flex-col items-center justify-center bg-[#0a0f1d]" style={{ minHeight: '300px' }}>
                    <iframe 
                      key={activeChannel.id}
                      src={activeChannel.streamUrl}
                      title={activeChannel.name}
                      className="w-full h-full border-0"
                      allowFullScreen
                    ></iframe>
                    
                    {/* 외부 사이트 시청 오버레이 안내 및 버튼 */}
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl text-center max-w-[90%] bg-slate-900/90 text-white">
                      <p className="text-xs font-semibold tracking-wider text-slate-300">보안 정책상 내부 화면이 나오지 않을 수 있습니다.</p>
                      <a 
                        href={activeChannel.streamUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        외부 페이지에서 방송 보기 ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Canvas: 비디오 프레임을 실시간으로 복사해서 화면에 출력 */}
                    <canvas 
                      ref={canvasRef}
                      className="video-element"
                    />
                    {/* Shadow DOM 호스트: <video> 태그를 Shadow DOM 내부에 격리하여 안드로이드 브라우저의
                        DOM 탐색 기반 다운로드 메뉴 감지를 원천 차단 */}
                    <div ref={shadowHostRef} style={{ display: 'none' }} />
                  </>
                )}
              </div>

              {/* 수평 스크롤바 (진행률 조절기) */}
              {activeChannel.streamType !== 'youtube' && activeChannel.streamType !== 'iframe' && isFinite(videoDuration) && videoDuration > 0 && (!activeChannel.isM3u || activeChannel.id.startsWith('local-mp4')) && (
                <div 
                  className={`player-scrubber-container ${(isHovered || isTouchActive) ? 'visible' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    refreshMouseHover();
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                    refreshMouseHover();
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    refreshMouseHover();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setIsTouchActive(true);
                    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                    setIsTouchActive(true);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    refreshTouchActive();
                  }}
                >
                  {/* 이전 영상 버튼 */}
                  <button 
                    onClick={handlePlayPrevious} 
                    className="scrubber-nav-btn"
                    title="이전 영상"
                    disabled={isShuffleMode ? filteredChannels.length <= 1 : !hasPreviousChannel}
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  {/* 반복 재생 토글 버튼 */}
                  <button 
                    onClick={() => setIsLoopMode(!isLoopMode)} 
                    className={`scrubber-nav-btn ${isLoopMode ? 'active-loop' : ''}`}
                    title={isLoopMode ? "반복 재생 비활성화" : "반복 재생 활성화"}
                  >
                    <Repeat className="w-4 h-4" />
                  </button>

                  {/* 랜덤 재생 토글 버튼 */}
                  <button 
                    onClick={() => setIsShuffleMode(!isShuffleMode)} 
                    className={`scrubber-nav-btn ${isShuffleMode ? 'active-shuffle' : ''}`}
                    title={isShuffleMode ? "순차 재생으로 변경" : "랜덤 재생 활성화"}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>

                  <span className="scrubber-time">{formatTime(videoCurrentTime)}</span>
                  <input 
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.1"
                    value={videoCurrentTime}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      isScrubbingRef.current = true;
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      isScrubbingRef.current = true;
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      isScrubbingRef.current = false;
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      isScrubbingRef.current = false;
                    }}
                    onChange={handleScrub}
                    className="player-scrubber-slider"
                    style={{
                      backgroundImage: `linear-gradient(to right, #ff3b30 0%, #ff3b30 ${(videoCurrentTime / videoDuration) * 100}%, rgba(255, 255, 255, 0.25) ${(videoCurrentTime / videoDuration) * 100}%, rgba(255, 255, 255, 0.25) 100%)`
                    }}
                  />
                  <span className="scrubber-time">{formatTime(videoDuration)}</span>

                  {/* 다음 영상 버튼 */}
                  <button 
                    onClick={handlePlayNext} 
                    className="scrubber-nav-btn"
                    title="다음 영상"
                    disabled={isShuffleMode ? filteredChannels.length <= 1 : !hasNextChannel}
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              )}

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

              {/* 줌 확대/축소 값 피드백 */}
              {zoomIndicator.show && (
                <div className="touch-notification">
                  <Maximize className="w-5 h-5 text-indigo-500" />
                  <div>
                    <div className="touch-notification-title">화면 배율</div>
                    <div className="touch-notification-value">{zoomIndicator.text}</div>
                  </div>
                </div>
              )}

              {/* 화면 배율 초기화 플로팅 버튼 오버레이 */}
              {showResetOverlay && (scaleX !== 1.0 || scaleY !== 1.0 || rotation !== 0 || panOffset.x !== 0 || panOffset.y !== 0) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setScaleX(1.0);
                    setScaleY(1.0);
                    setRotation(0);
                    setPanOffset({ x: 0, y: 0 });
                    showZoomFeedback(1.0, 1.0);
                    setShowResetOverlay(false);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  className="mobile-reset-zoom-btn"
                >
                  <RefreshCw className="w-4 h-4 mr-2" style={{ animation: 'spin 4s linear infinite' }} />
                  기본 화면으로 전환
                </button>
              )}

              {/* 마우스 전용 화면 조작 패널 */}
              <div 
                className="screen-control-panel"
                onMouseEnter={() => setIsHoveringPanel(true)}
                onMouseLeave={() => {
                  setIsHoveringPanel(false);
                  refreshMouseHover();
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {/* 전체 확대 */}
                <button 
                  onClick={() => {
                    const newX = Math.min(3.0, scaleX + 0.05);
                    const newY = Math.min(3.0, scaleY + 0.05);
                    setScaleX(newX);
                    setScaleY(newY);
                    showZoomFeedback(newX, newY);
                    triggerResetOverlay();
                  }}
                  title="전체 확대"
                  className="screen-ctrl-btn"
                >
                  <ZoomIn size={15} />
                </button>
                {/* 전체 축소 */}
                <button 
                  onClick={() => {
                    const newX = Math.max(0.5, scaleX - 0.05);
                    const newY = Math.max(0.5, scaleY - 0.05);
                    setScaleX(newX);
                    setScaleY(newY);
                    showZoomFeedback(newX, newY);
                    triggerResetOverlay();
                  }}
                  title="전체 축소"
                  className="screen-ctrl-btn"
                >
                  <ZoomOut size={15} />
                </button>

                <div className="screen-ctrl-divider" />

                {/* 좌우 확대 */}
                <button 
                  onClick={() => {
                    const newX = Math.min(3.0, scaleX + 0.05);
                    setScaleX(newX);
                    showZoomFeedback(newX, scaleY);
                    triggerResetOverlay();
                  }}
                  title="좌우 확대"
                  className="screen-ctrl-btn with-sub"
                >
                  <MoveHorizontal size={14} />
                  <span className="btn-sub-label">+</span>
                </button>
                {/* 좌우 축소 */}
                <button 
                  onClick={() => {
                    const newX = Math.max(0.5, scaleX - 0.05);
                    setScaleX(newX);
                    showZoomFeedback(newX, scaleY);
                    triggerResetOverlay();
                  }}
                  title="좌우 축소"
                  className="screen-ctrl-btn with-sub"
                >
                  <MoveHorizontal size={14} />
                  <span className="btn-sub-label">-</span>
                </button>

                <div className="screen-ctrl-divider" />

                {/* 상하 확대 */}
                <button 
                  onClick={() => {
                    const newY = Math.min(3.0, scaleY + 0.05);
                    setScaleY(newY);
                    showZoomFeedback(scaleX, newY);
                    triggerResetOverlay();
                  }}
                  title="상하 확대"
                  className="screen-ctrl-btn with-sub"
                >
                  <MoveVertical size={14} />
                  <span className="btn-sub-label">+</span>
                </button>
                {/* 상하 축소 */}
                <button 
                  onClick={() => {
                    const newY = Math.max(0.5, scaleY - 0.05);
                    setScaleY(newY);
                    showZoomFeedback(scaleX, newY);
                    triggerResetOverlay();
                  }}
                  title="상하 축소"
                  className="screen-ctrl-btn with-sub"
                >
                  <MoveVertical size={14} />
                  <span className="btn-sub-label">-</span>
                </button>

                <div className="screen-ctrl-divider" />

                {/* 시계방향 회전 */}
                <button 
                  onClick={() => {
                    const newRotation = (rotation + 90) % 360;
                    setRotation(newRotation);
                    showRotationFeedback(newRotation);
                    triggerResetOverlay();
                  }}
                  title="90도 회전"
                  className="screen-ctrl-btn"
                >
                  <RotateCw size={14} />
                </button>

                {/* 초기화 */}
                <button 
                  onClick={() => {
                    setScaleX(1.0);
                    setScaleY(1.0);
                    setRotation(0);
                    setPanOffset({ x: 0, y: 0 });
                    showZoomFeedback(1.0, 1.0);
                    triggerResetOverlay();
                  }}
                  title="화면 초기화"
                  className="screen-ctrl-btn reset"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* 스트리밍 오류 발생 시 오버레이 화면 */}
              {streamError && (
                <div className="player-error-overlay">
                  <div className="player-error-icon">⚠️</div>
                  <div className="player-error-title">{streamError}</div>
                  <div className="player-error-desc">
                    선택하신 방송의 스트림 서버가 오프라인(점검 중)이거나,<br />
                    국내 네트워크의 경우 **방통위(KCSC)에 의해 해외 주소가 차단**되었을 가능성이 큽니다.<br />
                    이 경우 휴대폰/PC에 **VPN(우회) 앱을 실행하고 재접속**하시면 즉시 정상 시청이 가능합니다.
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
                  {isPlaying ? <Pause size={21} className="fill-current" /> : <Play size={21} className="fill-current" />}
                </button>
              )}

              {/* 볼륨 슬라이더 */}
              <div className="volume-control-box">
                <button onClick={() => setIsMuted(!isMuted)} className="icon-btn">
                  {isMuted || volume === 0 ? <VolumeX size={18} className="text-red-500" /> : <Volume2 size={18} />}
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

              {/* 즐겨찾기 버튼 */}
              <button 
                onClick={(e) => toggleBookmark(activeChannel.id, e)} 
                className={`icon-btn heart-btn-controls ${bookmarks.includes(activeChannel.id) ? 'active' : ''}`}
                style={{ marginLeft: '10px' }}
                title="즐겨찾기 추가/해제"
              >
                <Heart size={18} className={bookmarks.includes(activeChannel.id) ? 'fill-red-600 text-red-600' : 'text-red-500'} />
              </button>
            </div>

            <div className="controls-right">
              {/* 전체화면 버튼 */}
              <button onClick={toggleFullscreen} className="icon-btn">
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>

        </section>

      </main>

      {/* M3U 파일 업로드 선택 모달 */}
      {isUploadModalOpen && (
        <div className="upload-modal-overlay">
          <div className="upload-modal-box">
            <h3 className="upload-modal-title">M3U 파일 불러오기</h3>
            <p className="upload-modal-desc">
              내장 목록(서버)을 선택하여 불러오거나,<br />
              원하시는 다른 파일이 있을 경우 직접 기기 파일을 선택할 수 있습니다.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>내장 목록 파일 선택</span>
              <div className="preset-radio-list">
                {PRELOADED_FILES.map((f) => {
                  const isSelected = selectedPresetFile === f.name && !isCustomInput;
                  return (
                    <label 
                      key={f.name} 
                      className={`preset-radio-item ${isSelected ? 'active' : ''}`}
                    >
                      <input 
                        type="radio" 
                        name="presetM3u" 
                        value={f.name} 
                        checked={isSelected}
                        onChange={() => handlePresetSelect(f.name)}
                        className="preset-radio-input"
                      />
                      <span className="preset-radio-text">
                        {f.label} <span className="preset-radio-filename">({f.name})</span>
                      </span>
                    </label>
                  );
                })}
                <label className={`preset-radio-item ${isCustomInput ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="presetM3u" 
                    value="custom" 
                    checked={isCustomInput}
                    onChange={() => {
                      setIsCustomInput(true);
                      setSelectedPresetFile('custom');
                    }}
                    className="preset-radio-input"
                  />
                  <span className="preset-radio-text">직접 파일명 입력...</span>
                </label>
              </div>
            </div>

            {isCustomInput && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>서버 내 파일명 직접 입력</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="예: Korea.m3u" 
                    value={inputFileName}
                    onChange={(e) => setInputFileName(e.target.value)}
                    className="upload-modal-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoadFromPublic();
                    }}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button 
                    onClick={handleLoadFromPublic}
                    className="m3u-btn primary-glow"
                    style={{ padding: '0 16px', height: '38px', whiteSpace: 'nowrap' }}
                  >
                    입력 완료
                  </button>
                </div>
              </div>
            )}

            <div className="upload-modal-buttons">
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  fileInputRef.current?.click();
                }}
                className="m3u-btn outline"
              >
                기기 파일 선택
              </button>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="m3u-btn text-only"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투명 저작권 표시 (맨 아래 배치) */}
      <div className="ott-copyright-text">
        <i>Copyright @ 2026 Shinbosung All Right Reserved. (v1.3.3 - 핀치 오동작 개선 완료)</i>
      </div>

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
