'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface Track {
  name: string;
  artists: { name: string }[];
  album: { name: string };
}

export default function Top5() {
  const { data: session, status } = useSession();
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    const fetchTopTracks = async () => {
      if (session?.accessToken) {
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5', {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
        const data = await response.json();
        setTracks(data.items);
      }
    };

    if (status === "authenticated") {
      fetchTopTracks();
    }
  }, [session, status]);

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (status === "unauthenticated") {
    return <div>Please sign in to view your top tracks</div>
  }

  return (
    <div>
      <h1>당신의 Top 5 트랙</h1>
      <ul>
        {tracks.map((track, index) => (
          <li key={index}>
            {track.name} - {track.artists.map(artist => artist.name).join(', ')} 
            (앨범: {track.album.name})
          </li>
        ))}
      </ul>
    </div>
  );
}