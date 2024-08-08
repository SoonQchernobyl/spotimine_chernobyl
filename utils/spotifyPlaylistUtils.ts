import { getSession } from "next-auth/react";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fetchWebApi(endpoint: string, method: string, body?: any) {
  const session = await getSession();
  if (!session?.accessToken) throw new Error("No access token");

  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export async function createPlaylist(trackIds: string[], playlistName: string) {
  console.log("Creating playlist:", playlistName);
  console.log("Track IDs:", trackIds);

  const { id: user_id } = await fetchWebApi("v1/me", "GET");
  console.log("User ID:", user_id);

  const playlist = await fetchWebApi(`v1/users/${user_id}/playlists`, "POST", {
    name: playlistName,
    description: "Playlist created based on audio features",
    public: false,
  });
  console.log("Created playlist:", playlist);

  if (playlist.id) {
    const addTracksResponse = await fetchWebApi(
      `v1/playlists/${playlist.id}/tracks`,
      "POST",
      {
        uris: trackIds.map((id) => `spotify:track:${id}`),
      }
    );
    console.log("Added tracks response:", addTracksResponse);
  }

  return playlist;
}

export function generateTemporaryPlaylistId() {
  return "temp_" + Math.random().toString(36).substr(2, 9);
}

export async function getTopTracksForFeature(
  feature: string,
  limit: number = 20,
  selectedTrackId?: string
) {
  const session = await getSession();
  if (!session?.accessToken) throw new Error("No access token");

  const response = await fetch(
    `/api/getExtremeTracks?feature=${feature}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  console.log("Tracks from DB:", data);

  let tracks = [];
  if (data[feature]) {
    tracks = [data[feature].highest, data[feature].lowest];
  }

  // 나머지 20개의 트랙을 Spotify API에서 가져오기
  const remainingTracksCount = limit - tracks.length;
  if (remainingTracksCount > 0) {
    const spotifyTracks = await fetchWebApi(
      `v1/recommendations?limit=${remainingTracksCount}&seed_tracks=${tracks
        .map((t) => t.id)
        .join(",")}`,
      "GET"
    );
    tracks = [...tracks, ...spotifyTracks.tracks];
  }

  // 선택된 트랙이 있으면 추가
  if (selectedTrackId) {
    const selectedTrack = await fetchWebApi(
      `v1/tracks/${selectedTrackId}`,
      "GET"
    );
    tracks.unshift(selectedTrack);
  }

  // 중복 제거 및 limit 적용
  const uniqueTracks = tracks
    .filter(
      (track, index, self) => index === self.findIndex((t) => t.id === track.id)
    )
    .slice(0, limit);

  console.log("Final tracks list:", uniqueTracks);
  return uniqueTracks.map((track) => track.id);
}

export async function createTemporaryPlaylist(
  trackIds: string[],
  playlistName: string
) {
  const { id: user_id } = await fetchWebApi("v1/me", "GET");

  // 임시 플레이리스트 생성 (비공개로 설정)
  const playlist = await fetchWebApi(`v1/users/${user_id}/playlists`, "POST", {
    name: playlistName,
    description: "Temporary playlist created by your app",
    public: false,
  });

  if (playlist.id) {
    await fetchWebApi(`v1/playlists/${playlist.id}/tracks`, "POST", {
      uris: trackIds.map((id) => `spotify:track:${id}`),
    });
  }

  return playlist;
}
export async function savePlaylistToSpotify(playlist) {
  const { id: user_id } = await fetchWebApi("v1/me", "GET");

  // 기존 플레이리스트를 복사하여 새로운 플레이리스트로 저장
  const savedPlaylist = await fetchWebApi(
    `v1/users/${user_id}/playlists`,
    "POST",
    {
      name: playlist.name,
      description: "Playlist created based on audio features",
      public: false,
    }
  );

  if (savedPlaylist.id) {
    const tracks = await fetchWebApi(
      `v1/playlists/${playlist.id}/tracks`,
      "GET"
    );
    await fetchWebApi(`v1/playlists/${savedPlaylist.id}/tracks`, "POST", {
      uris: tracks.items.map((item) => item.track.uri),
    });
  }

  return savedPlaylist;
}
