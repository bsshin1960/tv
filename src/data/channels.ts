export interface Program {
  title: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  description: string;
  rating: string;    // "ALL", "12", "15", "19"
}

export interface Channel {
  id: string;
  channelNumber: number;
  name: string;
  category: string;
  logo: string; // Emoji
  thumbnail: string; // OTT형 썸네일 고화질 이미지 URL
  streamUrl: string;
  streamType: 'hls' | 'mp4' | 'youtube';
  epg: Program[];
  groupTitle?: string;
  isM3u?: boolean;
}

// 누누티비 스타일의 장르 및 썸네일을 보강하고, 월드 m3u 채널을 추가한 방송 데이터
export const CHANNELS: Channel[] = [
  // 1. 지상파 채널군 (KBS, MBC, SBS, OCN, EBS)
  {
    id: 'kbs1',
    channelNumber: 9,
    name: 'KBS (대하드라마/예능)',
    category: '지상파',
    logo: '📺',
    thumbnail: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '1박 2일 시즌4 (인기 에피소드)', description: '우리가 아는 그 맛! 여섯 남자들의 예측 불허 리얼 야생 로드 버라이어티.', rating: '12' },
      { startTime: '09:00', endTime: '13:00', title: '홍김동전 다시보기', description: '동전 하나로 운명이 갈린다! 피 땀 눈물의 구 개념 버라이어티 예능.', rating: '15' },
      { startTime: '13:00', endTime: '18:00', title: '고려 거란 전쟁 (대작 드라마)', description: '관용의 리더십으로 고려를 하나로 모아 거란과의 전쟁을 승리로 이끈 현종과 강감찬의 대서사시.', rating: '15' },
      { startTime: '18:00', endTime: '21:00', title: '개그콘서트 스페셜', description: '새롭게 부활한 일요일 밤의 정통 코미디 활력 충전소.', rating: '12' },
      { startTime: '21:00', endTime: '23:30', title: '다큐멘터리 3일 베스트', description: '사람 냄새 나는 우리 이웃들의 72시간 인생 밀착 추적기.', rating: 'ALL' },
      { startTime: '23:30', endTime: '06:00', title: '역사저널 그날 (명작 정주행)', description: '역사적 사건의 긴박한 순간들을 입체적인 이야기로 재조명합니다.', rating: 'ALL' }
    ]
  },
  {
    id: 'mbc',
    channelNumber: 11,
    name: 'MBC (인기 예능/트렌디)',
    category: '지상파',
    logo: '🎥',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://devimages.apple.com.edgekey.net/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '태어난 김에 세계일주 3 (아프리카 편)', description: '기안84, 덱스, 빠니보틀의 야생 본능 가득한 날것의 인도 및 아프리카 종주기.', rating: '12' },
      { startTime: '09:00', endTime: '13:00', title: '연인 (조선 멜로 신작)', description: '병자호란의 참화 속에서 피어난 장현과 길채의 애절하고 엇갈리는 명품 사랑 이야기.', rating: '15' },
      { startTime: '13:00', endTime: '17:00', title: '나 혼자 산다 (스타 1인 라이프)', description: '매력 만점 혼자 사는 남녀 스타들의 진솔하고 자유로운 일상 공유.', rating: '15' },
      { startTime: '17:00', endTime: '20:00', title: '놀면 뭐하니? (유재석 버라이어티)', description: '다양한 릴레이 프로젝트와 부캐들의 유쾌한 도전기.', rating: '12' },
      { startTime: '20:00', endTime: '23:00', title: '오은영 리포트 - 결혼 지옥', description: '위기의 부부들에게 오은영 박사가 내리는 냉철하고 따뜻한 힐링 솔루션.', rating: '15' },
      { startTime: '23:00', endTime: '06:00', title: 'PD수첩 (사회 탐사 저널)', description: '시대의 어두운 진실을 가감 없이 폭로하는 정통 심층 보도.', rating: '19' }
    ]
  },
  {
    id: 'sbs',
    channelNumber: 6,
    name: 'SBS (화제작/예능/시사)',
    category: '지상파',
    logo: '🎬',
    thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '모범택시 2 (사적 복수 대행)', description: '베일에 싸인 택시회사 무지개 운수와 기사 김도기의 통쾌한 권선징악 사적 복수극.', rating: '15' },
      { startTime: '09:00', endTime: '13:00', title: '런닝맨 (릴레이 대형 예능)', description: '국민 MC 유재석과 멤버들이 펼치는 신나는 미션과 이름표 떼기 레이스.', rating: '12' },
      { startTime: '13:00', endTime: '17:00', title: '꼬리에 꼬리를 무는 그날 이야기', description: '역사상 가장 충격적이고 슬펐던 사건을 세 명의 이야기꾼이 들려줍니다.', rating: '15' },
      { startTime: '17:00', endTime: '20:00', title: '동상이몽 2 - 너는 내 운명', description: '다양한 부부들의 일상을 통해 남녀의 차이와 배려를 배우는 관찰 프로그램.', rating: '12' },
      { startTime: '20:00', endTime: '23:30', title: '소방서 옆 경찰서 그리고 국과수', description: '화재 잡는 소방과 범죄 잡는 경찰, 증거 찾는 국과수의 뜨거운 공조 수사극.', rating: '15' },
      { startTime: '23:30', endTime: '06:00', title: '그것이 알고 싶다 (장기 추적)', description: '사회의 미스터리 사건과 비리 현장을 심층 탐사하는 공정 보도 스페셜.', rating: '19' }
    ]
  },
  {
    id: 'ocn',
    channelNumber: 22,
    name: 'OCN (영화/스릴러/액션)',
    category: '지상파',
    logo: '🎞️',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://media.w3.org/2010/05/sintel/trailer_hd.mp4',
    streamType: 'mp4',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '특선 영화: [공조 2: 인터내셔날]', description: '삼각 공조로 뭉친 남북미 형사들의 유쾌하고 통쾌한 글로벌 범죄 소탕 작전.', rating: '15' },
      { startTime: '09:00', endTime: '12:00', title: '특선 영화: [서울의 봄]', description: '1979년 12월 12일 수도 서울에서 발생한 군사반란과 이를 막으려는 9시간의 사투.', rating: '12' },
      { startTime: '12:00', endTime: '15:00', title: '특선 영화: [범죄도시 3]', description: '괴물형사 마석도, 새로운 마약 범죄의 배후와 왜놈 야쿠자 조직원들을 시원하게 쓸어버린다!', rating: '15' },
      { startTime: '15:00', endTime: '18:30', title: '명작 다시보기: [아바타: 물의 길]', description: '판도라 행성에서 제이크 설리와 네이티리가 일군 가족과 새로운 물의 부족과의 모험.', rating: '12' },
      { startTime: '18:30', endTime: '21:00', title: 'OCN 오리지널: [보이스 4]', description: '초청력 살인마에 맞서 비모도에서 골든타임 수사팀이 벌이는 숨막히는 스릴러 공조.', rating: '19' },
      { startTime: '21:00', endTime: '24:00', title: '특선 야간 영화: [존 윅 4]', description: '자유를 향한 최후의 반격을 준비하는 전설의 킬러 존 윅의 한계 없는 액션.', rating: '19' },
      { startTime: '00:00', endTime: '06:00', title: '심야 공포 극장: [컨저링 3]', description: '악마가 시켜서 범행했다는 미국 역사상 전대미문의 살인 사건 실화 추적.', rating: '15' }
    ]
  },
  {
    id: 'ebs',
    channelNumber: 13,
    name: 'EBS (교육/다큐/애니메이션)',
    category: '지상파',
    logo: '🎓',
    thumbnail: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://playertest.longtailvideo.com/adaptive/bipbop/bipbop.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '딩동댕 유치원 & 뽀로로 극장', description: '우리 아이들의 올바른 아침 습관과 재미난 뽀로로 친구들의 3D 모험 이야기.', rating: 'ALL' },
      { startTime: '09:00', endTime: '12:00', title: '자이언트 펭TV (펭수 라이브)', description: 'EBS 최초 크리에이터 연습생 펭수의 거침없는 직장인 공감 코미디 쇼.', rating: 'ALL' },
      { startTime: '12:00', endTime: '16:00', title: '명품 다큐프라임: [인류의 진화]', description: '인류 문명 발전의 장구한 발자취와 과학적 미스터리를 입체적으로 탐방.', rating: 'ALL' },
      { startTime: '16:00', endTime: '19:00', title: 'EBS 스페이스 공감 스페셜', description: '주류와 비주류를 넘어 라이브 음악의 진정한 울림을 선사하는 무대.', rating: 'ALL' },
      { startTime: '19:00', endTime: '22:00', title: '세계 테마 기행 (남미 종단)', description: '현지인들의 삶 속으로 직접 걸어 들어가는 생생한 세계 문화 여행 다큐.', rating: 'ALL' },
      { startTime: '22:00', endTime: '24:00', title: '명의 (대한민국 대표 의학)', description: '각 분야 최고의 의학 명의들이 들려주는 질병 극복 스토리와 건강 정보.', rating: '12' },
      { startTime: '00:00', endTime: '06:00', title: '클래식 명작 영화관', description: '시대를 초월하여 오래도록 울림을 남기는 세계 불후의 명작 영화선.', rating: '15' }
    ]
  },

  // 2. 인터넷 방송
  {
    id: 'ytn-news',
    channelNumber: 24,
    name: 'YTN 실시간 속보 (라이브 뉴스)',
    category: '인터넷 방송',
    logo: '📰',
    thumbnail: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://www.youtube.com/embed/coYw-MBek-c?autoplay=1&mute=1',
    streamType: 'youtube',
    epg: [
      { startTime: '00:00', endTime: '24:00', title: 'YTN Live 뉴스 24 (속보 생중계)', description: '대한민국의 속보와 전세계 주요 뉴스를 24시간 실시간 생중계로 확인하세요.', rating: 'ALL' }
    ]
  },
  {
    id: 'twitch-stream-sintel',
    channelNumber: 99,
    name: 'Streamer Sintel (가상 게임 실황)',
    category: '인터넷 방송',
    logo: '🎮',
    thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    streamType: 'mp4',
    epg: [
      { startTime: '06:00', endTime: '12:00', title: '종합 게임 스피드런 챌린지', description: '명작 RPG 게임을 최단 시간으로 클리어하는 가상 게이머 스트리밍.', rating: '12' },
      { startTime: '12:00', endTime: '18:00', title: '마인크래프트 대규모 건축 방송', description: '시청자들과 소통하며 함께 대형 신전을 건설하는 실시간 야외 방.', rating: 'ALL' },
      { startTime: '18:00', endTime: '24:00', title: '스팀 신작 오컬트 호러 공포 실황', description: '소름 돋는 그래픽의 신작 서바이벌 호러 게임 첫날 플레이 엔딩.', rating: '19' },
      { startTime: '00:00', endTime: '06:00', title: '심야 노가리 & 고충 라디오', description: '은은한 BGM과 함께 시청자들의 메일을 읽고 위로하는 힐링 코너.', rating: '15' }
    ]
  },
  {
    id: 'twitch-stream-bbb',
    channelNumber: 101,
    name: 'Ani-World Live (가상 24H 애니)',
    category: '인터넷 방송',
    logo: '🦄',
    thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    streamType: 'mp4',
    epg: [
      { startTime: '00:00', endTime: '24:00', title: 'HD 3D 애니메이션 릴레이 라이브', description: '귀엽고 유쾌한 토끼 바니와 친구들의 고화질 3D 오픈소스 애니메이션 24시간 스트리밍.', rating: 'ALL' }
    ]
  },

  // 3. 신규 추가된 m3u 기반 해외 채널군 (CONtv Anime, Crackle TV, Cooking Panda, Dabl TV)
  {
    id: 'contv-anime',
    channelNumber: 105,
    name: 'CONtv Anime (글로벌 애니)',
    category: '해외 채널',
    logo: '👾',
    thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://contvanime-roku-ingest.cinedigm.com/master.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '00:00', endTime: '04:00', title: '[Classic] Retro Anime Showcase', description: 'Classic 80s & 90s action-packed sci-fi animation blocks.', rating: '15' },
      { startTime: '04:00', endTime: '08:00', title: '[Sci-Fi] Neo-Tokyo Chronicles', description: 'Futuristic cyberpunk anime series dealing with artificial intelligence.', rating: '15' },
      { startTime: '08:00', endTime: '12:00', title: '[Fantasy] Isekai Legend Marathon', description: 'Reborn in a magical world as a legendary wizard and starting an epic journey.', rating: '12' },
      { startTime: '12:00', endTime: '16:00', title: '[Action] Shonen Battle Arena', description: 'High-energy fight sequences, power tournaments, and friendship bonds.', rating: '12' },
      { startTime: '16:00', endTime: '20:00', title: '[Adventure] Ancient Mythical Beast Hunters', description: 'Exploring unknown ruins to seal mythical beasts with magical powers.', rating: '12' },
      { startTime: '20:00', endTime: '24:00', title: '[Thriller] Midnight Dark Fantasy', description: 'Mystery detectives solving paranormal incidents in urban city zones.', rating: '19' }
    ]
  },
  {
    id: 'crackle-tv',
    channelNumber: 107,
    name: 'Crackle Movies (해외 명작 영화)',
    category: '해외 채널',
    logo: '🗽',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://crackle-xumo.amagi.tv/playlist.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '[Thriller] The Silent Witness', description: 'A forensic investigator uncovers a shocking conspiracy behind a cold case.', rating: '15' },
      { startTime: '09:00', endTime: '12:00', title: '[Action] Double Crossfire', description: 'A retired special forces agent must fight his way out of an ambush to protect a witness.', rating: '15' },
      { startTime: '12:00', endTime: '16:00', title: '[Drama] Echoes of the Past', description: 'A heartwarming story of three generations rebuilding their legacy in a small town.', rating: '12' },
      { startTime: '16:00', endTime: '20:00', title: '[Sci-Fi] Galactic Vanguard', description: 'A space exploration crew discovers an ancient structure floating on the edge of the galaxy.', rating: '12' },
      { startTime: '20:00', endTime: '24:00', title: '[Blockbuster] Maximum Target', description: 'Highly-trained agents go head-to-head in a high-stakes tactical mission across Europe.', rating: '15' },
      { startTime: '00:00', endTime: '06:00', title: '[Mystery] Cryptic Shadow', description: 'A late-night radio host receives mysterious calls predicting local events.', rating: '19' }
    ]
  },
  {
    id: 'cooking-panda',
    channelNumber: 110,
    name: 'Cooking Panda (글로벌 쿡방)',
    category: '해외 채널',
    logo: '🐼',
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://stream-us-east-1.getpublica.com/playlist.m3u8?network_id=46',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: 'Ultimate Breakfast Masters', description: 'Unlocking fluffy pancakes, poached eggs, and artisan coffee techniques.', rating: 'ALL' },
      { startTime: '09:00', endTime: '12:00', title: 'Street Food Journeys: Asia', description: 'Tasting spicy noodles, grilled skewers, and local desserts in Bangkok & Seoul.', rating: 'ALL' },
      { startTime: '12:00', endTime: '15:00', title: 'Baking Secrets: French Pastry', description: 'Step-by-step masterclass for making crispy croissants and colorful macarons.', rating: 'ALL' },
      { startTime: '15:00', endTime: '18:00', title: '30-Minute Gourmet Meals', description: 'Fast, healthy, and premium dinners you can cook on busy weekdays.', rating: 'ALL' },
      { startTime: '18:00', endTime: '21:00', title: 'The Great BBQ Challenge', description: 'Ribs, brisket, and secret barbecue sauces compete in this backyard showdown.', rating: 'ALL' },
      { startTime: '21:00', endTime: '24:00', title: 'Midnight Cravings & Late Snacks', description: 'Cheesy pizzas, spicy chicken wings, and late-night comfort foods.', rating: '12' },
      { startTime: '00:00', endTime: '06:00', title: 'Rustic Kitchen: Slow Cooked Special', description: 'Hearty stews, soups, and traditional comfort foods simmering overnight.', rating: 'ALL' }
    ]
  },
  {
    id: 'dabl-tv',
    channelNumber: 112,
    name: 'Dabl Lifestyle (힐링 라이프)',
    category: '해외 채널',
    logo: '🏡',
    thumbnail: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'http://dai.google.com/linear/hls/event/oIKcyC8QThaW4F2KeB-Tdw/master.m3u8',
    streamType: 'hls',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: 'Morning Yoga & Meditation', description: 'Stretching exercises and breathing techniques to start a productive day.', rating: 'ALL' },
      { startTime: '09:00', endTime: '12:00', title: 'Extreme Home Remodel', description: 'Turning cluttered basements and old houses into stunning modern spaces.', rating: 'ALL' },
      { startTime: '12:00', endTime: '15:00', title: 'Garden Paradise: DIY Florals', description: 'Designing beautiful flower gardens and setting up backyard greenhouse setups.', rating: 'ALL' },
      { startTime: '15:00', endTime: '18:00', title: 'Pet Rescue & Smart Training', description: 'Professional animal trainers helping shelter pets find their home and learn tricks.', rating: 'ALL' },
      { startTime: '18:00', endTime: '21:00', title: 'Tiny House, Big Adventures', description: 'Touring space-efficient micro homes built by creative families on wheels.', rating: 'ALL' },
      { startTime: '21:00', endTime: '24:00', title: 'Modern Living & Smart Design', description: 'The latest home automation gadgets, smart lighting, and minimal architectures.', rating: 'ALL' },
      { startTime: '00:00', endTime: '06:00', title: 'Ambient Nature Sounds & Relax', description: 'Relaxing views of waterfalls, forests, and oceans with soft background music.', rating: 'ALL' }
    ]
  },

  // 4. 홈쇼핑 방송
  {
    id: 'gs-shop',
    channelNumber: 4,
    name: 'GS SHOP (실시간 단독 할인)',
    category: '홈쇼핑 방송',
    logo: '🛍️',
    thumbnail: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutback.mp4',
    streamType: 'mp4',
    epg: [
      { startTime: '06:00', endTime: '08:00', title: '다이어트 & 헬시 클럽 특가', description: '몸을 가볍게! 유기농 레몬즙 및 프리미엄 유산균 1+1 구성.', rating: 'ALL' },
      { startTime: '08:00', endTime: '11:00', title: '럭셔리 해외 명품 백 특집전', description: '프라다, 구찌 등 이탈리아 백 런칭 24주년 기념 무이자 24개월.', rating: 'ALL' },
      { startTime: '11:00', endTime: '14:00', title: '스마트 이지 청소기 타임딜', description: '밀고 쓸고 닦고를 한 번에 해결하는 무선 에어 청소기 단독 35% 세일.', rating: 'ALL' },
      { startTime: '14:00', endTime: '18:00', title: '안티에이징 기초 세트 특집', description: '화장품 임상 입증 주름 탄력 개선 크림 & 세럼 대용량 세트.', rating: 'ALL' },
      { startTime: '18:00', endTime: '21:00', title: '산지직송 한우 구이세트 (오늘마감)', description: '횡성 명품 한우 등심, 살치살 모둠 세트 한정수량 특별 구성.', rating: 'ALL' },
      { startTime: '21:00', endTime: '24:00', title: '초대형 UHD 스마트 TV 패키지', description: '프리미엄 75인치 고화질 TV 벽걸이 무상설치 특약전.', rating: 'ALL' },
      { startTime: '00:00', endTime: '06:00', title: '심야 올배미 세일 앵콜', description: '낮 시간 조기 마감되었던 베스트 주방/식품 타임세일 라스트 찬스.', rating: 'ALL' }
    ]
  },
  {
    id: 'cj-onstyle',
    channelNumber: 12,
    name: 'CJ 온스타일 (토탈 스타일 쇼)',
    category: '홈쇼핑 방송',
    logo: '💄',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&auto=format&fit=crop&q=80',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    streamType: 'mp4',
    epg: [
      { startTime: '06:00', endTime: '09:00', title: '먼지 없는 알러지프리 이불 세트', description: '피부 자극을 없애주는 고밀도 마이크로화이바 차렵 이불 패키지.', rating: 'ALL' },
      { startTime: '09:00', endTime: '12:00', title: '수분 폭탄 히알루론 크림 특집', description: '속건조 해결! 저분자 수분 탄력 영양 크림 4통 더블 사은품 세트.', rating: 'ALL' },
      { startTime: '12:00', endTime: '15:00', title: '초간편 한끼 직화 쭈꾸미 10팩', description: '매콤하고 쫄깃한 소문난 맛집의 비법 수제 양념 쭈꾸미.', rating: 'ALL' },
      { startTime: '15:00', endTime: '18:00', title: '데일리 에슬레저 팬츠 3종', description: '신축성과 형태 복원력이 뛰어난 사방 스판 매직 팬츠.', rating: 'ALL' },
      { startTime: '18:00', endTime: '21:00', title: '프리미엄 전신 3D 안마의자', description: '체형 분석 밀착 입체 케어 안마의자 무상 렌탈 설치 찬스.', rating: 'ALL' },
      { startTime: '21:00', endTime: '24:00', title: '골프 라이프 골프백 세트 런칭', description: '골프 명가 풀 패키지 구성! 캐디백 및 커버 사은품 100% 증정.', rating: 'ALL' },
      { startTime: '00:00', endTime: '06:00', title: '심야 베스트 아이템 파격딜', description: '오늘의 인기 완판 기록 베스트 제품들만 다시 모아 세일.', rating: 'ALL' }
    ]
  }
];

// 현재 시간 기준 진행 프로그램 정보와 진행률 계산 헬퍼 함수
export function getCurrentProgram(channel: Channel): { program: Program, progress: number, nextProgram: Program | null } {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let activeProgram: Program | null = null;
  let nextProgram: Program | null = null;
  let activeIndex = -1;

  for (let i = 0; i < channel.epg.length; i++) {
    const p = channel.epg[i];
    const [startH, startM] = p.startTime.split(':').map(Number);
    const [endH, endM] = p.endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    let isMatch = false;
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      isMatch = true;
    }
    const currentMinutesNextDay = currentMinutes + 24 * 60;
    if (!isMatch && currentMinutesNextDay >= startMinutes && currentMinutesNextDay < endMinutes) {
      isMatch = true;
    }

    if (isMatch) {
      activeProgram = p;
      activeIndex = i;
      break;
    }
  }

  if (!activeProgram) {
    activeProgram = channel.epg[0];
    activeIndex = 0;
  }

  if (activeIndex !== -1 && activeIndex < channel.epg.length - 1) {
    nextProgram = channel.epg[activeIndex + 1];
  } else {
    nextProgram = channel.epg[0];
  }

  const [startH, startM] = activeProgram.startTime.split(':').map(Number);
  const [endH, endM] = activeProgram.endTime.split(':').map(Number);
  const startMin = startH * 60 + startM;
  let endMin = endH * 60 + endM;
  if (endMin < startMin) endMin += 24 * 60;

  let currentMin = now.getHours() * 60 + now.getMinutes();
  if (currentMin < startMin && currentMin + 24 * 60 < endMin) {
    currentMin += 24 * 60;
  }

  const duration = endMin - startMin;
  const elapsed = currentMin - startMin;
  const progress = duration > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100))) : 0;

  return {
    program: activeProgram,
    progress,
    nextProgram
  };
}
