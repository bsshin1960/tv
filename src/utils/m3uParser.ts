import type { Channel, Program } from '../data/channels';

function generateMockEPG(channelName: string): Program[] {
  return [
    { 
      startTime: '00:00', 
      endTime: '04:00', 
      title: `[심야] ${channelName} 스페셜`, 
      description: `${channelName}에서 엄선한 스페셜 콘텐츠를 24시간 논스톱으로 방영합니다.`, 
      rating: '12' 
    },
    { 
      startTime: '04:00', 
      endTime: '08:00', 
      title: `[새벽] ${channelName} 라이브`, 
      description: `이른 아침을 깨우는 ${channelName}의 시그니처 힐링/뉴스 프로그램.`, 
      rating: 'ALL' 
    },
    { 
      startTime: '08:00', 
      endTime: '12:00', 
      title: `[오전] ${channelName} 핫클립`, 
      description: `시청자들이 가장 사랑한 ${channelName} 인기 에피소드 몰아보기 스페셜.`, 
      rating: 'ALL' 
    },
    { 
      startTime: '12:00', 
      endTime: '16:00', 
      title: `[오후] ${channelName} 골든 타임`, 
      description: `나른한 오후 시간을 채워줄 ${channelName}의 대표 예능 및 교양 다큐멘터리.`, 
      rating: '12' 
    },
    { 
      startTime: '16:00', 
      endTime: '20:00', 
      title: `[저녁] ${channelName} 프라임 포커스`, 
      description: `온 가족이 함께 감상하는 ${channelName}의 고화질 대표 프로그램입니다.`, 
      rating: '15' 
    },
    { 
      startTime: '20:00', 
      endTime: '24:00', 
      title: `[심야] ${channelName} 시네마/예능`, 
      description: `하루를 마무리하는 시간, ${channelName}이 선사하는 짜릿한 즐거움.`, 
      rating: '15' 
    }
  ];
}

export function parseM3U(text: string): Channel[] {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  
  let currentMetadata: {
    tvgId: string;
    logo: string;
    groupTitle: string;
    name: string;
  } | null = null;
  
  let channelCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgId = idMatch ? idMatch[1] : '';

      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const logo = logoMatch ? logoMatch[1] : '';

      const groupMatch = line.match(/group-title="([^"]*)"/);
      const groupTitle = groupMatch ? groupMatch[1] : '기타';

      const commaIndex = line.lastIndexOf(',');
      let name = 'M3U 채널';
      if (commaIndex !== -1) {
        name = line.substring(commaIndex + 1).trim();
      }

      currentMetadata = { tvgId, logo, groupTitle, name };
    } else if (!line.startsWith('#')) {
      if (currentMetadata && (line.startsWith('http://') || line.startsWith('https://'))) {
        const streamUrl = line;
        
        let streamType: 'hls' | 'mp4' | 'youtube' = 'hls';
        if (streamUrl.includes('youtube.com/') || streamUrl.includes('youtu.be/')) {
          streamType = 'youtube';
        } else if (streamUrl.endsWith('.mp4') || streamUrl.includes('.mp4?')) {
          streamType = 'mp4';
        }

        channelCount++;
        
        channels.push({
          id: `m3u-${currentMetadata.tvgId || channelCount}-${channelCount}`,
          channelNumber: 1000 + channelCount,
          name: currentMetadata.name,
          category: 'M3U 방송',
          logo: '🌐',
          thumbnail: currentMetadata.logo || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=80',
          streamUrl: streamUrl,
          streamType: streamType,
          epg: generateMockEPG(currentMetadata.name),
          groupTitle: currentMetadata.groupTitle,
          isM3u: true
        });

        currentMetadata = null;
      }
    }
  }

  return channels;
}
