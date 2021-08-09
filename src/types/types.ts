import { User } from "discord.js";

export type Genre =
  | "Rock"
  | "Pop Rock"
  | "Pop"
  | "R&B"
  | "Hip-Hop"
  | "Jazz"
  | "Metal"
  | "Blues"
  | "Reggae"
  | "Classical"
  | "Contemporary R&B"
  | "Country"
  | "Folk"
  | "Folk/Rock"
  | "Funk"
  | "Grunge"
  | "Indie Pop"
  | "Indie Rock"
  | "R&B/Soul"
  | "Synthwave"
  | "Alternative/Indie"
  | "Hip-Hop/Rap"
  | "Classic Rock"
  | "Progressive/Art Rock";

export interface ISong {
  artist: string;
  genre?: Genre | Genre[];
  title: string;
  start: number;
  youtubeWatchCode: string;
}

export interface IRound {
  round: number;
  titleWonBy?: User;
  artistWonBy?: User;
}
