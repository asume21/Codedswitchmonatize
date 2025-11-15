/**
 * Studio Router - Unified routing with session context
 * Provides type-safe navigation and session handling
 */

import { useSongWorkSession } from '@/contexts/SongWorkSessionContext';
import { useLocation } from 'wouter';
import { emitEvent } from './eventBus';

/**
 * All studio routes
 */
export const routes = {
  home: '/',
  studio: '/studio',
  songUploader: '/song-uploader',
  lyricLab: '/lyric-lab',
  beatMaker: '/beat-studio',
  melodyComposer: '/melody-composer',
  mixer: '/pro-console',
  pianoRoll: '/piano-roll',
  arrangement: '/arrangement',
  effects: '/effects',
  aiAssistant: '/ai-assistant',
  codeToMusic: '/code-to-music',
  musicToCode: '/music-to-code',
} as const;

export type RouteName = keyof typeof routes;

/**
 * Studio Router Hook
 */
export function useStudioRouter() {
  const [, setLocation] = useLocation();
  const { createSession, currentSession } = useSongWorkSession();

  /**
   * Navigate to a route with optional session
   */
  const navigate = (route: RouteName, sessionId?: string) => {
    const path = routes[route];
    const finalPath = sessionId ? `${path}?session=${sessionId}` : path;
    
    emitEvent('tool:opened', { 
      tool: route, 
      sessionId 
    });
    
    setLocation(finalPath);
  };

  /**
   * Navigate with song context (creates session automatically)
   */
  const navigateWithSong = (
    route: RouteName,
    song: { name: string; audioUrl?: string }
  ) => {
    const sessionId = createSession({
      name: song.name,
      audioUrl: song.audioUrl,
    });

    emitEvent('session:created', {
      sessionId,
      songName: song.name,
    });

    navigate(route, sessionId);
  };

  /**
   * Navigate using current session
   */
  const navigateWithCurrentSession = (route: RouteName) => {
    if (currentSession) {
      navigate(route, currentSession.sessionId);
    } else {
      navigate(route);
    }
  };

  /**
   * Get current route name
   */
  const getCurrentRoute = (): RouteName | null => {
    const [location] = useLocation();
    const path = location.split('?')[0];
    
    for (const [name, routePath] of Object.entries(routes)) {
      if (routePath === path) {
        return name as RouteName;
      }
    }
    
    return null;
  };

  /**
   * Get session ID from current URL
   */
  const getSessionFromUrl = (): string | null => {
    const [location] = useLocation();
    const params = new URLSearchParams(location.split('?')[1]);
    return params.get('session');
  };

  /**
   * Build URL with session
   */
  const buildUrl = (route: RouteName, sessionId?: string): string => {
    const path = routes[route];
    return sessionId ? `${path}?session=${sessionId}` : path;
  };

  return {
    navigate,
    navigateWithSong,
    navigateWithCurrentSession,
    getCurrentRoute,
    getSessionFromUrl,
    buildUrl,
    routes,
  };
}

/**
 * Example usage:
 * 
 * const { navigate, navigateWithSong } = useStudioRouter();
 * 
 * // Simple navigation
 * navigate('beatMaker');
 * 
 * // Navigate with song (auto-creates session)
 * navigateWithSong('lyricLab', { 
 *   name: 'My Song.mp3',
 *   audioUrl: 'https://...'
 * });
 * 
 * // Navigate with current session
 * navigateWithCurrentSession('mixer');
 */
